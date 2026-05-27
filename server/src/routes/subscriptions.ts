import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { parsePagination, paginatedResult } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const SubscriptionSchema = z.object({
  name: z.string().min(1),
  category: z.string().default(''),
  vendor: z.string().default(''),
  cost_monthly: z.number().default(0),
  cost_annual: z.number().default(0),
  currency: z.string().default('EUR'),
  billing_cycle: z.enum(['mensuel', 'annuel', 'usage', 'hebdomadaire']).default('mensuel'),
  cost_weekly: z.number().default(0),
  renewal_date: z.string().default(''),
  auto_renew: z.boolean().default(false),
  responsible: z.string().default(''),
  status: z.enum(['actif', 'à_résilier', 'expiré', 'en_négociation']).default('actif'),
  contract_url: z.string().default(''),
  notes: z.string().default(''),
});

// GET /api/subscriptions
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { search, status, category, billing_cycle } = req.query;
  const pagination = parsePagination(req);

  const where: Record<string, unknown> = { organization_id: orgId };
  if (status) where.status = status;
  if (category) where.category = category;
  if (billing_cycle) where.billing_cycle = billing_cycle;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { vendor: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [total, subscriptions] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: { renewal_date: 'asc' },
      take: pagination.limit,
      skip: pagination.skip,
    }),
  ]);

  res.json(paginatedResult(subscriptions, total, pagination));
});

// GET /api/subscriptions/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const subscription = await prisma.subscription.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!subscription) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  res.json(subscription);
});

// POST /api/subscriptions
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = SubscriptionSchema.parse(req.body);

  const subscription = await prisma.subscription.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      ...body,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'subscription.created',
    targetType: 'subscription',
    targetId: subscription.id,
    targetLabel: subscription.name,
    oldValue: {},
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(subscription);
});

// PUT /api/subscriptions/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.subscription.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const body = SubscriptionSchema.partial().parse(req.body);

  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: body,
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'subscription.updated',
    targetType: 'subscription',
    targetId: subscription.id,
    targetLabel: subscription.name,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(subscription);
});

// DELETE /api/subscriptions/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.subscription.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  await prisma.subscription.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'subscription.deleted',
    targetType: 'subscription',
    targetId: existing.id,
    targetLabel: existing.name,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

export default router;
