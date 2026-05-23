import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/superadmin';
import { config } from '../config';

const router = Router();

// ─── GET /api/admin/stats ───
router.get('/stats', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  const [orgs_count, users_count, alerts_count, members_count, planGroups] = await Promise.all([
    prisma.organization.count(),
    prisma.userApp.count(),
    prisma.alert.count(),
    prisma.member.count(),
    prisma.organization.groupBy({
      by: ['plan'],
      _count: { _all: true },
    }),
  ]);

  const plans: Record<string, number> = {};
  for (const group of planGroups) {
    plans[group.plan] = group._count._all;
  }

  res.json({ orgs_count, users_count, alerts_count, members_count, plans });
});

// ─── GET /api/admin/orgs ───
router.get('/orgs', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      plan_expires_at: true,
      created_at: true,
      _count: {
        select: {
          users: true,
          members: true,
          alerts: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const result = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    plan: org.plan,
    plan_expires_at: org.plan_expires_at,
    created_at: org.created_at,
    users_count: org._count.users,
    members_count: org._count.members,
    alerts_count: org._count.alerts,
  }));

  res.json(result);
});

// ─── PATCH /api/admin/orgs/:id/plan ───
router.patch('/orgs/:id/plan', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { plan, plan_expires_at } = req.body as { plan?: string; plan_expires_at?: string };

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      ...(plan !== undefined && { plan }),
      ...(plan_expires_at !== undefined && { plan_expires_at: new Date(plan_expires_at) }),
    },
  });

  res.json(updated);
});

// ─── GET /api/admin/users ───
router.get('/users', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  const users = await prisma.userApp.findMany({
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      is_superadmin: true,
      last_login_at: true,
      created_at: true,
      organization: {
        select: {
          id: true,
          name: true,
          plan: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  res.json(users);
});

// ─── POST /api/admin/setup ───
// Protected only by SUPER_ADMIN_SETUP_KEY header — no requireAuth
router.post('/setup', async (req: Request, res: Response) => {
  const setupKey = req.headers['x-setup-key'];

  if (!config.superAdminSetupKey || setupKey !== config.superAdminSetupKey) {
    res.status(403).json({ error: 'Invalid or missing setup key' });
    return;
  }

  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const user = await prisma.userApp.findUnique({ where: { email } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const updated = await prisma.userApp.update({
    where: { email },
    data: { is_superadmin: true },
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      is_superadmin: true,
    },
  });

  res.json({ message: 'Super-admin granted', user: updated });
});

export default router;
