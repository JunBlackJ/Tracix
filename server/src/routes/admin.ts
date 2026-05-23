import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { requireSuperAdmin, generateSuperAdminToken } from '../middleware/superadmin';
import { config } from '../config';

const router = Router();

// ─── POST /api/admin/login ───
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (
    !config.superAdminEmail ||
    !config.superAdminPassword ||
    email !== config.superAdminEmail ||
    password !== config.superAdminPassword
  ) {
    res.status(401).json({ error: 'Identifiants incorrects' });
    return;
  }

  const token = generateSuperAdminToken();
  res.json({ token });
});

// ─── GET /api/admin/stats ───
router.get('/stats', requireSuperAdmin, async (_req: Request, res: Response) => {
  const [orgs_count, users_count, alerts_count, members_count, planGroups] = await Promise.all([
    prisma.organization.count(),
    prisma.userApp.count(),
    prisma.alert.count(),
    prisma.member.count(),
    prisma.organization.groupBy({ by: ['plan'], _count: { _all: true } }),
  ]);

  const plans: Record<string, number> = {};
  for (const group of planGroups) plans[group.plan] = group._count._all;

  res.json({ orgs_count, users_count, alerts_count, members_count, plans });
});

// ─── GET /api/admin/orgs ───
router.get('/orgs', requireSuperAdmin, async (_req: Request, res: Response) => {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true, name: true, plan: true, plan_expires_at: true, created_at: true,
      _count: { select: { users: true, members: true, alerts: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  res.json(orgs.map((org) => ({
    id: org.id, name: org.name, plan: org.plan,
    plan_expires_at: org.plan_expires_at, created_at: org.created_at,
    users_count: org._count.users, members_count: org._count.members, alerts_count: org._count.alerts,
  })));
});

// ─── PATCH /api/admin/orgs/:id/plan ───
router.patch('/orgs/:id/plan', requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { plan, plan_expires_at } = req.body as { plan?: string; plan_expires_at?: string | null };

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      ...(plan !== undefined && { plan }),
      plan_expires_at: plan_expires_at ? new Date(plan_expires_at) : null,
    },
  });

  res.json(updated);
});

// ─── GET /api/admin/users ───
router.get('/users', requireSuperAdmin, async (_req: Request, res: Response) => {
  const users = await prisma.userApp.findMany({
    select: {
      id: true, full_name: true, email: true, role: true,
      last_login_at: true, created_at: true,
      organization: { select: { id: true, name: true, plan: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  res.json(users);
});

export default router;
