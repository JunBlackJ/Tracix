import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/audit-trail
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { actor, action, target_type, target_id, page, limit } = req.query;

  const take = Math.min(parseInt(limit as string || '100', 10), 500);
  const skip = (parseInt(page as string || '1', 10) - 1) * take;

  const where: Record<string, unknown> = { organization_id: orgId };
  if (actor) where.actor = { contains: actor as string, mode: 'insensitive' };
  if (action) where.action = { contains: action as string, mode: 'insensitive' };
  if (target_type) where.target_type = target_type;
  if (target_id) where.target_id = target_id;

  const [total, entries] = await Promise.all([
    prisma.auditTrail.count({ where }),
    prisma.auditTrail.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take,
      skip,
    }),
  ]);

  res.json({
    data: entries,
    pagination: {
      total,
      page: parseInt(page as string || '1', 10),
      limit: take,
      pages: Math.ceil(total / take),
    },
  });
});

// GET /api/audit-trail/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const entry = await prisma.auditTrail.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!entry) {
    res.status(404).json({ error: 'Audit trail entry not found' });
    return;
  }

  res.json(entry);
});

export default router;
