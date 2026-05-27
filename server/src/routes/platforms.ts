import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { getLimits, checkLimit } from '../services/plan.service';
import { parsePagination, paginatedResult } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const PlatformSchema = z.object({
  name: z.string().min(1),
  category: z.string().default(''),
  access_type: z.string().default(''),
  url: z.string().default(''),
  auth_method: z.string().default(''),
  has_mfa: z.boolean().default(false),
  environment: z.enum(['production', 'staging', 'dev']).default('production'),
  responsible: z.string().default(''),
  target_population: z.string().default(''),
  sla: z.string().default(''),
  status: z.enum(['actif', 'inactif', 'déprécié']).default('actif'),
  last_check_date: z.string().default(''),
  notes: z.string().default(''),
});

// GET /api/platforms
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { search, status, environment, category } = req.query;
  const pagination = parsePagination(req);

  const where: Record<string, unknown> = { organization_id: orgId };
  if (status) where.status = status;
  if (environment) where.environment = environment;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { responsible: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [total, platforms] = await Promise.all([
    prisma.platform.count({ where }),
    prisma.platform.findMany({
      where,
      include: {
        accessRights: {
          include: { member: { select: { id: true, full_name: true, username: true } } },
        },
      },
      orderBy: { name: 'asc' },
      take: pagination.limit,
      skip: pagination.skip,
    }),
  ]);

  res.json(paginatedResult(platforms, total, pagination));
});

// GET /api/platforms/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const platform = await prisma.platform.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      accessRights: {
        include: { member: true },
      },
    },
  });

  if (!platform) {
    res.status(404).json({ error: 'Platform not found' });
    return;
  }

  res.json(platform);
});

// POST /api/platforms
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = PlatformSchema.parse(req.body);

  // Plan limit check
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  const currentCount = await prisma.platform.count({ where: { organization_id: orgId } });
  const limitError = checkLimit(currentCount, limits.platforms, 'plateformes');
  if (limitError) { res.status(403).json({ error: limitError }); return; }

  const platform = await prisma.platform.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      ...body,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'platform.created',
    targetType: 'platform',
    targetId: platform.id,
    targetLabel: platform.name,
    oldValue: {},
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(platform);
});

// PUT /api/platforms/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.platform.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Platform not found' });
    return;
  }

  const body = PlatformSchema.partial().parse(req.body);

  const platform = await prisma.platform.update({
    where: { id: req.params.id },
    data: body,
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'platform.updated',
    targetType: 'platform',
    targetId: platform.id,
    targetLabel: platform.name,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(platform);
});

// DELETE /api/platforms/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.platform.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Platform not found' });
    return;
  }

  await prisma.platform.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'platform.deleted',
    targetType: 'platform',
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
