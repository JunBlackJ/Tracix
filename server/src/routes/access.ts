import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { updateMemberRiskScore } from '../services/risk.service';

const router = Router();
router.use(requireAuth);

const AccessRightSchema = z.object({
  member_id: z.string(),
  platform_id: z.string(),
  level: z.enum(['admin', 'rw', 'ro', 'req', 'none']),
  granted_by: z.string().default(''),
  last_review_date: z.string().default(''),
  next_review_date: z.string().default(''),
  reviewed_by: z.string().default(''),
  notes: z.string().default(''),
});

const UpdateLevelSchema = z.object({
  level: z.enum(['admin', 'rw', 'ro', 'req', 'none']),
  comment: z.string().optional(),
});

// GET /api/access-rights
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { member_id, platform_id, level } = req.query;

  const where: Record<string, unknown> = { organization_id: orgId };
  if (member_id) where.member_id = member_id;
  if (platform_id) where.platform_id = platform_id;
  if (level) where.level = level;

  const accessRights = await prisma.accessRight.findMany({
    where,
    include: {
      member: { select: { id: true, full_name: true, username: true, account_type: true, status: true } },
      platform: { select: { id: true, name: true, category: true, has_mfa: true } },
    },
    orderBy: [{ member_id: 'asc' }, { platform_id: 'asc' }],
  });

  res.json(accessRights);
});

// GET /api/access-rights/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const ar = await prisma.accessRight.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      member: true,
      platform: true,
    },
  });

  if (!ar) {
    res.status(404).json({ error: 'Access right not found' });
    return;
  }

  res.json(ar);
});

// POST /api/access-rights
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = AccessRightSchema.parse(req.body);

  // Verify member and platform belong to org
  const [member, platform] = await Promise.all([
    prisma.member.findFirst({ where: { id: body.member_id, organization_id: orgId } }),
    prisma.platform.findFirst({ where: { id: body.platform_id, organization_id: orgId } }),
  ]);

  if (!member) {
    res.status(400).json({ error: 'Member not found in organization' });
    return;
  }
  if (!platform) {
    res.status(400).json({ error: 'Platform not found in organization' });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const accessRight = await prisma.accessRight.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      ...body,
      granted_at: today,
      last_review_date: body.last_review_date || today,
    },
  });

  await updateMemberRiskScore(body.member_id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'access.granted',
    targetType: 'access_right',
    targetId: accessRight.id,
    targetLabel: `${member.full_name} → ${platform.name}`,
    oldValue: { level: 'none' },
    newValue: { level: body.level, granted_by: body.granted_by },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(accessRight);
});

// PUT /api/access-rights/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.accessRight.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      member: { select: { full_name: true } },
      platform: { select: { name: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Access right not found' });
    return;
  }

  const body = AccessRightSchema.partial().omit({ member_id: true, platform_id: true }).parse(req.body);

  const updated = await prisma.accessRight.update({
    where: { id: req.params.id },
    data: body,
  });

  await updateMemberRiskScore(existing.member_id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'access.updated',
    targetType: 'access_right',
    targetId: updated.id,
    targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: body as Record<string, unknown>,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(updated);
});

// PUT /api/access-rights/:id/level — update access level with audit
router.put('/:id/level', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = UpdateLevelSchema.parse(req.body);

  const existing = await prisma.accessRight.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      member: { select: { full_name: true } },
      platform: { select: { name: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Access right not found' });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const updated = await prisma.accessRight.update({
    where: { id: req.params.id },
    data: {
      level: body.level,
      last_review_date: today,
      reviewed_by: req.user!.email,
      notes: body.comment ? `${existing.notes ? existing.notes + ' | ' : ''}${body.comment}` : existing.notes,
    },
  });

  await updateMemberRiskScore(existing.member_id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'access.level_changed',
    targetType: 'access_right',
    targetId: updated.id,
    targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
    oldValue: { level: existing.level },
    newValue: { level: body.level, comment: body.comment ?? '' },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(updated);
});

// POST /api/access-rights/:id/revoke — revoke access
router.post('/:id/revoke', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { comment } = z.object({ comment: z.string().optional() }).parse(req.body);

  const existing = await prisma.accessRight.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      member: { select: { full_name: true } },
      platform: { select: { name: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Access right not found' });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const updated = await prisma.accessRight.update({
    where: { id: req.params.id },
    data: {
      level: 'none',
      last_review_date: today,
      reviewed_by: req.user!.email,
      notes: comment ? `${existing.notes ? existing.notes + ' | ' : ''}Révoqué: ${comment}` : existing.notes,
    },
  });

  await updateMemberRiskScore(existing.member_id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'access.revoked',
    targetType: 'access_right',
    targetId: updated.id,
    targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
    oldValue: { level: existing.level },
    newValue: { level: 'none', comment: comment ?? '' },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(updated);
});

// DELETE /api/access-rights/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.accessRight.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      member: { select: { full_name: true } },
      platform: { select: { name: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Access right not found' });
    return;
  }

  await prisma.accessRight.delete({ where: { id: req.params.id } });
  await updateMemberRiskScore(existing.member_id);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'access.deleted',
    targetType: 'access_right',
    targetId: existing.id,
    targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

export default router;
