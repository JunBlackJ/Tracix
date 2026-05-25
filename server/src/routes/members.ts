import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { updateMemberRiskScore, recomputeAllRiskScores } from '../services/risk.service';
import { getLimits, checkLimit } from '../services/plan.service';
import { processOffboarding } from '../services/cron.service';

const router = Router();
router.use(requireAuth);

const MemberSchema = z.object({
  full_name: z.string().min(1),
  username: z.string().min(1),
  team: z.string().default(''),
  account_type: z.enum(['privilégié', 'nominatif', 'service', 'partagé']),
  status: z.enum(['actif', 'inactif', 'suspendu']).default('actif'),
  email: z.string().email(),
  departure_date: z.string().nullable().optional(),
  notes: z.string().default(''),
});

// GET /api/members
router.get('/', requirePermission('members.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { search, status, team, account_type } = req.query;

  const where: Record<string, unknown> = { organization_id: orgId };
  if (status) where.status = status;
  if (team) where.team = team;
  if (account_type) where.account_type = account_type;
  if (search) {
    where.OR = [
      { full_name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { username: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const members = await prisma.member.findMany({
    where,
    include: { accessRights: true },
    orderBy: { full_name: 'asc' },
  });

  res.json(members);
});

// GET /api/members/:id
router.get('/:id', requirePermission('members.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const member = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      accessRights: {
        include: { platform: true },
      },
    },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  res.json(member);
});

// POST /api/members/recompute-all — recompute risk scores for all members in org
router.post('/recompute-all', requirePermission('members.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  await recomputeAllRiskScores(orgId);
  const members = await prisma.member.findMany({
    where: { organization_id: orgId },
    orderBy: { full_name: 'asc' },
  });
  res.json({ recomputed: members.length, members });
});

// GET /api/members/:id/risk
router.get('/:id/risk', requirePermission('members.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const member = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const updated = await prisma.member.findUnique({ where: { id: req.params.id } });
  await updateMemberRiskScore(req.params.id);
  const refreshed = await prisma.member.findUnique({ where: { id: req.params.id } });
  res.json(refreshed ?? updated);
});

// POST /api/members
router.post('/', requirePermission('members.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = MemberSchema.parse(req.body);

  // Plan limit check
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  const currentCount = await prisma.member.count({ where: { organization_id: orgId } });
  const limitError = checkLimit(currentCount, limits.members, 'membres');
  if (limitError) { res.status(403).json({ error: limitError }); return; }

  const member = await prisma.member.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      ...body,
      departure_date: body.departure_date ?? null,
      risk_score: 50,
      risk_factors: [],
    },
  });

  await updateMemberRiskScore(member.id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'member.created',
    targetType: 'member',
    targetId: member.id,
    targetLabel: member.full_name,
    oldValue: {},
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  const updated = await prisma.member.findUnique({ where: { id: member.id } });
  res.status(201).json(updated);
});

// PUT /api/members/:id
router.put('/:id', requirePermission('members.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const body = MemberSchema.partial().parse(req.body);

  const member = await prisma.member.update({
    where: { id: req.params.id },
    data: { ...body, departure_date: body.departure_date === undefined ? undefined : (body.departure_date ?? null) },
  });

  await updateMemberRiskScore(member.id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'member.updated',
    targetType: 'member',
    targetId: member.id,
    targetLabel: member.full_name,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  const updated = await prisma.member.findUnique({ where: { id: member.id } });
  res.json(updated);
});

// POST /api/members/:id/offboard — déclencher l'offboarding manuellement
router.post('/:id/offboard', requirePermission('members.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const member = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: { accessRights: { where: { level: { not: 'none' } } } },
  });
  if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

  // Revoke all active access rights
  const revokedCount = member.accessRights.length;
  if (revokedCount > 0) {
    await prisma.accessRight.updateMany({
      where: { member_id: member.id, level: { not: 'none' } },
      data: { level: 'none', notes: `Révoqué lors de l'offboarding par ${req.user!.email}` },
    });
  }

  // Set member status to inactif
  await prisma.member.update({ where: { id: member.id }, data: { status: 'inactif' } });

  // Resolve open member_offboarding alerts
  await prisma.alert.updateMany({
    where: { organization_id: orgId, source_id: member.id, type: 'member_offboarding', is_resolved: false },
    data: { is_resolved: true, resolved_by: req.user!.email, resolved_at: new Date().toISOString() },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'member.offboarded',
    targetType: 'member',
    targetId: member.id,
    targetLabel: member.full_name,
    oldValue: { status: member.status, access_count: revokedCount },
    newValue: { status: 'inactif', access_count: 0 },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  const updated = await prisma.member.findUnique({ where: { id: member.id } });
  res.json({ success: true, revokedCount, member: updated });
});

// DELETE /api/members/:id
router.delete('/:id', requirePermission('members.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  await prisma.member.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'member.deleted',
    targetType: 'member',
    targetId: existing.id,
    targetLabel: existing.full_name,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

export default router;
