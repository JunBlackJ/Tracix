import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';

const router = Router();
router.use(requireAuth);

// GET /api/reviews — liste des campagnes
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const campaigns = await prisma.reviewCampaign.findMany({
    where: { organization_id: orgId },
    include: { items: { select: { decision: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(campaigns.map((c) => ({
    ...c,
    totalItems: c.items.length,
    pendingItems: c.items.filter((i) => i.decision === 'pending').length,
    completedItems: c.items.filter((i) => i.decision !== 'pending').length,
    items: undefined,
  })));
});

// POST /api/reviews — créer une campagne
const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  due_date: z.string().optional().default(''),
  // filtres optionnels pour cibler la campagne
  platformIds: z.array(z.string()).optional(),
  teamFilter: z.string().optional(),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { name, description, due_date, platformIds, teamFilter } = CreateSchema.parse(req.body);

  // Trouver tous les droits d'accès actifs à revoir
  const whereAccess: Record<string, unknown> = {
    organization_id: orgId,
    level: { not: 'none' },
  };
  if (platformIds?.length) whereAccess.platform_id = { in: platformIds };

  let accessRights = await prisma.accessRight.findMany({
    where: whereAccess,
    include: { member: { select: { team: true, status: true } } },
  });

  if (teamFilter) {
    accessRights = accessRights.filter((a) => a.member.team === teamFilter);
  }
  // Exclure les membres inactifs
  accessRights = accessRights.filter((a) => a.member.status === 'actif');

  if (accessRights.length === 0) {
    res.status(400).json({ error: 'Aucun droit d\'accès actif trouvé avec ces critères.' });
    return;
  }

  const campaignId = uuidv4();
  const campaign = await prisma.reviewCampaign.create({
    data: {
      id: campaignId,
      organization_id: orgId,
      name,
      description,
      due_date,
      created_by: req.user!.email,
      status: 'active',
    },
  });

  // Créer un ReviewItem par droit d'accès
  await prisma.reviewItem.createMany({
    data: accessRights.map((a) => ({
      id: uuidv4(),
      campaign_id: campaignId,
      organization_id: orgId,
      member_id: a.member_id,
      platform_id: a.platform_id,
      access_right_id: a.id,
      original_level: a.level,
      decision: 'pending',
    })),
  });

  await createAuditEntry({ organizationId: orgId, actor: req.user!.email, action: 'review.create', targetType: 'review', targetId: campaignId, targetLabel: name, oldValue: {}, newValue: { name, itemCount: accessRights.length }, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' });

  res.status(201).json({ ...campaign, totalItems: accessRights.length, pendingItems: accessRights.length, completedItems: 0 });
});

// GET /api/reviews/:id — détail d'une campagne + ses items
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const campaign = await prisma.reviewCampaign.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      items: {
        orderBy: { created_at: 'asc' },
      },
    },
  });
  if (!campaign) { res.status(404).json({ error: 'Campagne non trouvée' }); return; }
  res.json(campaign);
});

// PATCH /api/reviews/:id/items/:itemId — décider sur un item
const DecideSchema = z.object({
  decision: z.enum(['confirmed', 'revoked', 'modified']),
  new_level: z.string().optional().default(''),
  comment: z.string().optional().default(''),
});

router.patch('/:id/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { decision, new_level, comment } = DecideSchema.parse(req.body);

  const item = await prisma.reviewItem.findFirst({
    where: { id: req.params.itemId, campaign_id: req.params.id, organization_id: orgId },
  });
  if (!item) { res.status(404).json({ error: 'Item non trouvé' }); return; }

  const updated = await prisma.reviewItem.update({
    where: { id: item.id },
    data: { decision, new_level, comment, reviewed_by: req.user!.email, reviewed_at: new Date() },
  });

  // Appliquer immédiatement la décision sur l'AccessRight
  if (decision === 'revoked') {
    await prisma.accessRight.update({ where: { id: item.access_right_id }, data: { level: 'none', notes: comment || 'Révoqué lors d\'une revue' } });
  } else if (decision === 'modified' && new_level) {
    await prisma.accessRight.update({ where: { id: item.access_right_id }, data: { level: new_level, notes: comment } });
  } else if (decision === 'confirmed') {
    const today = new Date().toISOString().split('T')[0];
    await prisma.accessRight.update({ where: { id: item.access_right_id }, data: { last_review_date: today, reviewed_by: req.user!.email } });
  }

  res.json(updated);
});

// POST /api/reviews/:id/bulk — décisions en masse
const BulkSchema = z.object({
  itemIds: z.array(z.string()),
  decision: z.enum(['confirmed', 'revoked']),
  comment: z.string().optional().default(''),
});

router.post('/:id/bulk', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { itemIds, decision, comment } = BulkSchema.parse(req.body);

  const items = await prisma.reviewItem.findMany({
    where: { id: { in: itemIds }, campaign_id: req.params.id, organization_id: orgId },
  });

  const today = new Date().toISOString().split('T')[0];
  for (const item of items) {
    await prisma.reviewItem.update({
      where: { id: item.id },
      data: { decision, comment, reviewed_by: req.user!.email, reviewed_at: new Date() },
    });
    if (decision === 'revoked') {
      await prisma.accessRight.update({ where: { id: item.access_right_id }, data: { level: 'none', notes: comment || 'Révoqué en masse' } });
    } else {
      await prisma.accessRight.update({ where: { id: item.access_right_id }, data: { last_review_date: today, reviewed_by: req.user!.email } });
    }
  }

  // Auto-compléter la campagne si tout est traité
  const remaining = await prisma.reviewItem.count({ where: { campaign_id: req.params.id, decision: 'pending' } });
  if (remaining === 0) {
    await prisma.reviewCampaign.update({ where: { id: req.params.id }, data: { status: 'completed', completed_at: new Date() } });
  }

  await createAuditEntry({ organizationId: orgId, actor: req.user!.email, action: `review.bulk.${decision}`, targetType: 'review', targetId: req.params.id, targetLabel: `${items.length} items`, oldValue: {}, newValue: { count: items.length, decision }, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' });

  res.json({ processed: items.length, remaining });
});

// POST /api/reviews/:id/complete — clôturer la campagne
router.post('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const campaign = await prisma.reviewCampaign.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!campaign) { res.status(404).json({ error: 'Campagne non trouvée' }); return; }

  await prisma.reviewCampaign.update({ where: { id: req.params.id }, data: { status: 'completed', completed_at: new Date() } });
  await createAuditEntry({ organizationId: orgId, actor: req.user!.email, action: 'review.complete', targetType: 'review', targetId: req.params.id, targetLabel: campaign.name, oldValue: {}, newValue: { status: 'completed' }, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' });

  res.json({ success: true });
});

// DELETE /api/reviews/:id — supprimer une campagne
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  await prisma.reviewCampaign.deleteMany({ where: { id: req.params.id, organization_id: orgId } });
  res.status(204).end();
});

export default router;
