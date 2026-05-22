import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';

const router = Router();
router.use(requireAuth);

const SystemSchema = z.object({
  system_id: z.string().min(1),
  hostname: z.string().min(1),
  type: z.string().default(''),
  environment: z.enum(['production', 'staging', 'dev']).default('production'),
  os_version: z.string().default(''),
  ip_address: z.string().default(''),
  vlan: z.string().default(''),
  location: z.string().default(''),
  role_usage: z.string().default(''),
  owner: z.string().default(''),
  tech_responsible: z.string().default(''),
  criticality: z.enum(['critique', 'élevée', 'normale', 'faible']).default('normale'),
  status: z.enum(['actif', 'inactif', 'maintenance']).default('actif'),
  deployment_date: z.string().default(''),
  end_of_support_date: z.string().default(''),
  backup_policy: z.string().default(''),
  last_patch_date: z.string().default(''),
  notes: z.string().default(''),
});

// GET /api/systems
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { search, status, environment, criticality } = req.query;

  const where: Record<string, unknown> = { organization_id: orgId };
  if (status) where.status = status;
  if (environment) where.environment = environment;
  if (criticality) where.criticality = criticality;
  if (search) {
    where.OR = [
      { hostname: { contains: search as string, mode: 'insensitive' } },
      { system_id: { contains: search as string, mode: 'insensitive' } },
      { owner: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const systems = await prisma.system.findMany({
    where,
    orderBy: { hostname: 'asc' },
  });

  res.json(systems);
});

// GET /api/systems/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const system = await prisma.system.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!system) {
    res.status(404).json({ error: 'System not found' });
    return;
  }

  res.json(system);
});

// POST /api/systems
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = SystemSchema.parse(req.body);

  const system = await prisma.system.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      ...body,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'system.created',
    targetType: 'system',
    targetId: system.id,
    targetLabel: system.hostname,
    oldValue: {},
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(system);
});

// PUT /api/systems/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.system.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'System not found' });
    return;
  }

  const body = SystemSchema.partial().parse(req.body);

  const system = await prisma.system.update({
    where: { id: req.params.id },
    data: body,
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'system.updated',
    targetType: 'system',
    targetId: system.id,
    targetLabel: system.hostname,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(system);
});

// DELETE /api/systems/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.system.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'System not found' });
    return;
  }

  await prisma.system.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'system.deleted',
    targetType: 'system',
    targetId: existing.id,
    targetLabel: existing.hostname,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

export default router;
