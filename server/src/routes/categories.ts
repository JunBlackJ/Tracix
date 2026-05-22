import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { getLimits, checkLimit } from '../services/plan.service';

const router = Router();
router.use(requireAuth);

const CategorySchema = z.object({
  type: z.enum(['subscription', 'platform', 'team']),
  label: z.string().min(1),
  color: z.string().default('#6B7280'),
});

// GET /api/categories
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { type } = req.query;
  const where: Record<string, unknown> = { organization_id: orgId };
  if (type) where.type = type;
  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
  });
  res.json(categories);
});

// POST /api/categories
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = CategorySchema.parse(req.body);

  // Plan limit check
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  const currentCount = await prisma.category.count({ where: { organization_id: orgId } });
  const limitError = checkLimit(currentCount, limits.categories, 'catégories');
  if (limitError) { res.status(403).json({ error: limitError }); return; }

  // Check duplicate
  const existing = await prisma.category.findFirst({
    where: { organization_id: orgId, type: body.type, label: body.label },
  });
  if (existing) {
    res.status(409).json({ error: 'Cette catégorie existe déjà' });
    return;
  }

  const category = await prisma.category.create({
    data: { id: uuidv4(), organization_id: orgId, ...body },
  });
  res.status(201).json(category);
});

// PUT /api/categories/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) { res.status(404).json({ error: 'Catégorie non trouvée' }); return; }

  const body = CategorySchema.partial().parse(req.body);
  const updated = await prisma.category.update({ where: { id: req.params.id }, data: body });
  res.json(updated);
});

// DELETE /api/categories/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) { res.status(404).json({ error: 'Catégorie non trouvée' }); return; }
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
