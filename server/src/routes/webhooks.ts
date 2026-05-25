import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditEntry, getClientIp } from '../middleware/audit';

const router = Router();
router.use(requireAuth);

const WebhookSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(['slack', 'teams', 'discord', 'pagerduty', 'custom']),
  url: z.string().url(),
  events: z.array(z.string()).default(['alert.critical']),
  active: z.boolean().default(true),
});

// GET /api/webhooks
router.get('/', requirePermission('webhooks.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const webhooks = await (prisma as any).webhookEndpoint.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: 'asc' },
  });
  res.json(webhooks);
});

// POST /api/webhooks
router.post('/', requirePermission('webhooks.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = WebhookSchema.parse(req.body);

  const signingSecret = crypto.randomBytes(24).toString('hex');

  const webhook = await (prisma as any).webhookEndpoint.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      name: body.name,
      provider: body.provider,
      url: body.url,
      events: body.events,
      active: body.active,
      signing_secret: signingSecret,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'webhook.created',
    targetType: 'webhook',
    targetId: webhook.id,
    targetLabel: body.name,
    oldValue: {},
    newValue: { name: body.name, provider: body.provider, url: body.url },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(webhook);
});

// PUT /api/webhooks/:id
router.put('/:id', requirePermission('webhooks.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await (prisma as any).webhookEndpoint.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const body = WebhookSchema.partial().parse(req.body);

  const updated = await (prisma as any).webhookEndpoint.update({
    where: { id: req.params.id },
    data: body,
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'webhook.updated',
    targetType: 'webhook',
    targetId: updated.id,
    targetLabel: updated.name,
    oldValue: existing as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(updated);
});

// DELETE /api/webhooks/:id
router.delete('/:id', requirePermission('webhooks.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await (prisma as any).webhookEndpoint.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  await (prisma as any).webhookEndpoint.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'webhook.deleted',
    targetType: 'webhook',
    targetId: existing.id,
    targetLabel: existing.name,
    oldValue: existing as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

// POST /api/webhooks/:id/test
router.post('/:id/test', requirePermission('webhooks.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const webhook = await (prisma as any).webhookEndpoint.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!webhook) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const payload = {
    event: 'alert.critical',
    organization: 'Tracix Org',
    alert: {
      type: 'test',
      severity: 'critical',
      message: 'Ceci est un test de webhook Tracix',
      created_at: '2025-01-01T08:00:00Z',
    },
  };

  const body = JSON.stringify(payload);
  const sig = crypto
    .createHmac('sha256', webhook.signing_secret || '')
    .update(body)
    .digest('hex');

  let statusCode = 0;
  let success = false;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tracix-Event': 'test',
        'X-Tracix-Signature': `sha256=${sig}`,
      },
      body,
    });
    statusCode = response.status;
    success = response.ok;
  } catch (err: unknown) {
    statusCode = 0;
    success = false;
  }

  await (prisma as any).webhookEndpoint.update({
    where: { id: webhook.id },
    data: { last_triggered_at: new Date(), last_status_code: statusCode },
  });

  res.json({ success, status_code: statusCode });
});

export default router;
