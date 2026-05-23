import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { requireSuperAdmin, generateSuperAdminToken } from '../middleware/superadmin';
import { config } from '../config';
import { adminLimiter } from '../index';

const router = Router();

// ─── POST /api/admin/login ───
router.post('/login', adminLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (
    !config.superAdminEmail || !config.superAdminPassword ||
    email !== config.superAdminEmail || password !== config.superAdminPassword
  ) {
    res.status(401).json({ error: 'Identifiants incorrects' });
    return;
  }
  res.json({ token: generateSuperAdminToken() });
});

// ─── GET /api/admin/stats ───
router.get('/stats', requireSuperAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [orgs_count, users_count, alerts_count, members_count, planGroups, recentOrgs] = await Promise.all([
    prisma.organization.count(),
    prisma.userApp.count(),
    prisma.alert.count({ where: { is_resolved: false } }),
    prisma.member.count(),
    prisma.organization.groupBy({ by: ['plan'], _count: { _all: true } }),
    // Inscriptions par jour sur 30 jours
    prisma.organization.findMany({
      where: { created_at: { gte: thirtyDaysAgo } },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    }),
  ]);

  const plans: Record<string, number> = {};
  for (const group of planGroups) plans[group.plan] = group._count._all;

  // Agréger par jour
  const byDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().split('T')[0]] = 0;
  }
  for (const org of recentOrgs) {
    const day = org.created_at.toISOString().split('T')[0];
    if (byDay[day] !== undefined) byDay[day]++;
  }
  const growth = Object.entries(byDay).map(([date, count]) => ({ date, count }));

  res.json({ orgs_count, users_count, alerts_count, members_count, plans, growth });
});

// ─── GET /api/admin/orgs ───
router.get('/orgs', requireSuperAdmin, async (_req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgs = await (prisma.organization.findMany as any)({
    select: {
      id: true, name: true, plan: true, plan_expires_at: true, created_at: true,
      is_suspended: true,
      _count: { select: { users: true, members: true, alerts: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json(orgs.map((org: any) => ({
    id: org.id, name: org.name, plan: org.plan,
    plan_expires_at: org.plan_expires_at, created_at: org.created_at,
    is_suspended: org.is_suspended ?? false,
    users_count: org._count.users, members_count: org._count.members, alerts_count: org._count.alerts,
  })));
});

// ─── GET /api/admin/orgs/:id ───
router.get('/orgs/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [org, recentAudit] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.organization.findUnique as any)({
      where: { id },
      include: {
        _count: { select: { users: true, members: true, alerts: true, platforms: true, subscriptions: true } },
      },
    }),
    prisma.auditTrail.findMany({
      where: { organization_id: id },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: { id: true, actor: true, action: true, target_label: true, created_at: true },
    }),
  ]);

  if (!org) { res.status(404).json({ error: 'Organisation introuvable' }); return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = org as any;
  res.json({
    id: o.id, name: o.name, plan: o.plan,
    plan_expires_at: o.plan_expires_at, created_at: o.created_at,
    is_suspended: o.is_suspended ?? false,
    users_count: o._count.users, members_count: o._count.members,
    alerts_count: o._count.alerts, platforms_count: o._count.platforms,
    subscriptions_count: o._count.subscriptions,
    recent_audit: recentAudit,
  });
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

// ─── PATCH /api/admin/orgs/:id/suspend ───
router.patch('/orgs/:id/suspend', requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { suspended } = req.body as { suspended: boolean };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.organization.update as any)({
    where: { id },
    data: { is_suspended: suspended },
  });

  res.json({ id: updated.id, is_suspended: updated.is_suspended ?? false });
});

// ─── DELETE /api/admin/orgs/:id ───
router.delete('/orgs/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.organization.delete({ where: { id } });
  res.json({ ok: true });
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

// ─── GET /api/admin/audit ───
router.get('/audit', requireSuperAdmin, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '50'), 200);
  const offset = parseInt((req.query.offset as string) || '0');

  const [total, entries] = await Promise.all([
    prisma.auditTrail.count(),
    prisma.auditTrail.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true, actor: true, action: true, target_type: true,
        target_label: true, ip_address: true, created_at: true,
        organization: { select: { id: true, name: true } },
      },
    }),
  ]);

  res.json({ total, entries });
});

export default router;
