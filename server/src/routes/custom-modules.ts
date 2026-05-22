import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { getLimits, checkLimit } from '../services/plan.service';

const router = Router();
router.use(requireAuth);

const ModuleSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  module_type: z.enum(['liste', 'contacts', 'documents', 'procedures', 'notes', 'kpis']).default('liste'),
  icon: z.string().default('Layers'),
  color: z.string().default('#534AB7'),
  nav_order: z.number().default(0),
});

const EntrySchema = z.object({
  data: z.record(z.unknown()).default({}),
});

// ─── Modules CRUD ───

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const modules = await prisma.customModule.findMany({
    where: { organization_id: orgId },
    orderBy: { nav_order: 'asc' },
    include: { _count: { select: { entries: true } } },
  });
  res.json(modules);
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const mod = await prisma.customModule.findFirst({
    where: { id: req.params.id, organization_id: orgId },
    include: {
      entries: { orderBy: { created_at: 'asc' } },
    },
  });
  if (!mod) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  res.json(mod);
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = ModuleSchema.parse(req.body);

  // Plan limit check
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  if (!limits.customModulesEnabled) {
    res.status(403).json({ error: 'Les modules personnalisés nécessitent le plan Pro. Passez à Pro pour créer des modules.' });
    return;
  }
  const currentCount = await prisma.customModule.count({ where: { organization_id: orgId } });
  const limitError = checkLimit(currentCount, limits.customModules, 'modules personnalisés');
  if (limitError) { res.status(403).json({ error: limitError }); return; }

  const mod = await prisma.customModule.create({
    data: { id: uuidv4(), organization_id: orgId, ...body },
  });
  res.status(201).json(mod);
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.customModule.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!existing) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  const body = ModuleSchema.partial().parse(req.body);
  const updated = await prisma.customModule.update({ where: { id: req.params.id }, data: body });
  res.json(updated);
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.customModule.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!existing) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  await prisma.customModule.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Entries CRUD ───

router.get('/:id/entries', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const mod = await prisma.customModule.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!mod) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  const entries = await prisma.customEntry.findMany({
    where: { module_id: req.params.id },
    orderBy: { created_at: 'asc' },
  });
  res.json(entries);
});

router.post('/:id/entries', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const mod = await prisma.customModule.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!mod) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  const body = EntrySchema.parse(req.body);
  const entry = await prisma.customEntry.create({
    data: { id: uuidv4(), module_id: req.params.id, data: body.data as Prisma.InputJsonValue },
  });
  res.status(201).json(entry);
});

router.put('/:id/entries/:entryId', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const mod = await prisma.customModule.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!mod) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  const body = EntrySchema.parse(req.body);
  const updated = await prisma.customEntry.update({ where: { id: req.params.entryId }, data: { data: body.data as Prisma.InputJsonValue } });
  res.json(updated);
});

router.delete('/:id/entries/:entryId', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const mod = await prisma.customModule.findFirst({ where: { id: req.params.id, organization_id: orgId } });
  if (!mod) { res.status(404).json({ error: 'Module non trouvé' }); return; }
  await prisma.customEntry.delete({ where: { id: req.params.entryId } });
  res.status(204).send();
});

export default router;
