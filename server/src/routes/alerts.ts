import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { generateAlerts } from '../services/alert.service';

const router = Router();
router.use(requireAuth);

// GET /api/alerts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { is_resolved, severity, type, source_module } = req.query;

  const where: Record<string, unknown> = { organization_id: orgId };
  if (is_resolved !== undefined) where.is_resolved = is_resolved === 'true';
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (source_module) where.source_module = source_module;

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: [{ is_resolved: 'asc' }, { created_at: 'desc' }],
  });

  res.json(alerts);
});

// GET /api/alerts/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const alert = await prisma.alert.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  res.json(alert);
});

// PATCH /api/alerts/resolve-all  — must be before /:id/resolve to avoid :id matching "resolve-all"
router.patch('/resolve-all', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = z.object({ ids: z.array(z.string()) }).parse(req.body);

  // Verify all alerts belong to org
  const alertsToResolve = await prisma.alert.findMany({
    where: {
      id: { in: body.ids },
      organization_id: orgId,
      is_resolved: false,
    },
  });

  if (alertsToResolve.length === 0) {
    res.json({ resolved: 0 });
    return;
  }

  const today = new Date().toISOString();
  const result = await prisma.alert.updateMany({
    where: {
      id: { in: alertsToResolve.map((a) => a.id) },
      organization_id: orgId,
    },
    data: {
      is_resolved: true,
      resolved_by: req.user!.email,
      resolved_at: today,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'alert.bulk_resolved',
    targetType: 'alert',
    targetId: 'bulk',
    targetLabel: `${result.count} alertes résolues`,
    oldValue: {},
    newValue: { resolved_count: result.count, ids: body.ids },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ resolved: result.count });
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.alert.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  const today = new Date().toISOString();
  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: {
      is_resolved: true,
      resolved_by: req.user!.email,
      resolved_at: today,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'alert.resolved',
    targetType: 'alert',
    targetId: alert.id,
    targetLabel: alert.message.slice(0, 60),
    oldValue: { is_resolved: false },
    newValue: { is_resolved: true, resolved_by: req.user!.email, resolved_at: today },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(alert);
});

// POST /api/alerts/generate — trigger alert engine
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  await generateAlerts(orgId);
  const alerts = await prisma.alert.findMany({
    where: { organization_id: orgId, is_resolved: false },
    orderBy: { created_at: 'desc' },
  });
  res.json({ generated: true, alerts });
});

export default router;
