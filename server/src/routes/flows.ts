import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { parsePagination, paginatedResult } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const NetworkFlowSchema = z.object({
  flow_id: z.string().min(1),
  source_host: z.string().default(''),
  source_zone: z.string().default(''),
  destination_host: z.string().default(''),
  destination_zone: z.string().default(''),
  port: z.string().default(''),
  protocol: z.string().default(''),
  service: z.string().default(''),
  direction: z.enum(['entrant', 'sortant', 'bidirectionnel']).default('entrant'),
  status: z.enum(['autorisé', 'bloqué', 'conditionnel']).default('autorisé'),
  firewall_rule: z.string().default(''),
  justification: z.string().default(''),
  responsible: z.string().default(''),
  last_review_date: z.string().default(''),
});

// GET /api/network-flows
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { search, status, direction } = req.query;
  const pagination = parsePagination(req);

  const where: Record<string, unknown> = { organization_id: orgId };
  if (status) where.status = status;
  if (direction) where.direction = direction;
  if (search) {
    where.OR = [
      { flow_id: { contains: search as string, mode: 'insensitive' } },
      { source_host: { contains: search as string, mode: 'insensitive' } },
      { destination_host: { contains: search as string, mode: 'insensitive' } },
      { service: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [total, flows] = await Promise.all([
    prisma.networkFlow.count({ where }),
    prisma.networkFlow.findMany({
      where,
      orderBy: { flow_id: 'asc' },
      take: pagination.limit,
      skip: pagination.skip,
    }),
  ]);

  res.json(paginatedResult(flows, total, pagination));
});

// GET /api/network-flows/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const flow = await prisma.networkFlow.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!flow) {
    res.status(404).json({ error: 'Network flow not found' });
    return;
  }

  res.json(flow);
});

// POST /api/network-flows
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = NetworkFlowSchema.parse(req.body);

  const flow = await prisma.networkFlow.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      ...body,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'flow.created',
    targetType: 'network_flow',
    targetId: flow.id,
    targetLabel: flow.flow_id,
    oldValue: {},
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(flow);
});

// PUT /api/network-flows/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.networkFlow.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Network flow not found' });
    return;
  }

  const body = NetworkFlowSchema.partial().parse(req.body);

  const flow = await prisma.networkFlow.update({
    where: { id: req.params.id },
    data: body,
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'flow.updated',
    targetType: 'network_flow',
    targetId: flow.id,
    targetLabel: flow.flow_id,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(flow);
});

// DELETE /api/network-flows/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.networkFlow.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Network flow not found' });
    return;
  }

  await prisma.networkFlow.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'flow.deleted',
    targetType: 'network_flow',
    targetId: existing.id,
    targetLabel: existing.flow_id,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

export default router;
