import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin, generateSecret as genTotpSecret } from 'otplib';
import * as QRCode from 'qrcode';

// Singleton TOTP instance with required plugins
const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });
function totpVerify(token: string, secret: string): Promise<boolean> {
  return totp.verify(token, { secret }) as unknown as Promise<boolean>;
}
function totpGenerate(secret: string): Promise<string> {
  return totp.generate({ secret }) as unknown as Promise<string>;
}
import prisma from '../prisma/client';
import { requireSuperAdmin, generateSuperAdminToken } from '../middleware/superadmin';
import { config } from '../config';
import { adminLimiter } from '../middleware/rateLimiter';

const router = Router();

// Compteur brute-force en mémoire pour le super-admin (compte unique, pas en DB)
let adminFailedAttempts = 0;
let adminLockedUntil: Date | null = null;

// ─── POST /api/admin/login ───
router.post('/login', adminLimiter, async (req: Request, res: Response) => {
  // Vérifier le verrouillage
  if (adminLockedUntil && adminLockedUntil > new Date()) {
    const minutesLeft = Math.ceil((adminLockedUntil.getTime() - Date.now()) / 60000);
    res.status(429).json({ error: `Panneau verrouillé. Réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.` });
    return;
  }

  const { email, password } = req.body as { email?: string; password?: string };
  const valid =
    config.superAdminEmail && config.superAdminPassword &&
    email === config.superAdminEmail && password === config.superAdminPassword;

  if (!valid) {
    adminFailedAttempts++;
    if (adminFailedAttempts >= 5) {
      adminLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      adminFailedAttempts = 0;
      res.status(429).json({ error: 'Trop de tentatives. Panneau verrouillé 30 minutes.' });
      return;
    }
    // Délai progressif
    await new Promise((r) => setTimeout(r, adminFailedAttempts * 500));
    res.status(401).json({ error: `Identifiants incorrects. ${5 - adminFailedAttempts} tentative${5 - adminFailedAttempts > 1 ? 's' : ''} restante${5 - adminFailedAttempts > 1 ? 's' : ''}.` });
    return;
  }

  // Succès — vérifier si MFA est activé
  adminFailedAttempts = 0;
  adminLockedUntil = null;

  const adminConfig = await prisma.adminConfig.findUnique({ where: { id: 'global' } });
  if (adminConfig?.totp_enabled && adminConfig.totp_secret) {
    // MFA requis — retourner un challenge (pas de token JWT encore)
    res.json({ mfa_required: true });
    return;
  }

  res.json({ token: generateSuperAdminToken() });
});

// ─── POST /api/admin/login/mfa ─── Validation du code TOTP après email/password
router.post('/login/mfa', adminLimiter, async (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  if (!totp) { res.status(400).json({ error: 'Code TOTP requis' }); return; }

  const adminConfig = await prisma.adminConfig.findUnique({ where: { id: 'global' } });
  if (!adminConfig?.totp_enabled || !adminConfig.totp_secret) {
    res.status(400).json({ error: 'MFA non configuré' }); return;
  }

  const valid = await totpVerify(totp.replace(/\s/g, ''), adminConfig.totp_secret);
  if (!valid) {
    res.status(401).json({ error: 'Code incorrect ou expiré' }); return;
  }

  res.json({ token: generateSuperAdminToken() });
});

// ─── GET /api/admin/mfa/status ───
router.get('/mfa/status', requireSuperAdmin, async (_req: Request, res: Response) => {
  const adminConfig = await prisma.adminConfig.findUnique({ where: { id: 'global' } });
  res.json({ enabled: adminConfig?.totp_enabled ?? false });
});

// ─── POST /api/admin/mfa/setup ─── Génère un nouveau secret TOTP + QR code (sans l'activer)
router.post('/mfa/setup', requireSuperAdmin, async (_req: Request, res: Response) => {
  const secret = genTotpSecret();
  const label = encodeURIComponent(config.superAdminEmail || 'admin@tracix.io');
  const issuer = 'Tracix%20Admin';
  const otpauth = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  // Stocker le secret provisoire (pas encore activé)
  await prisma.adminConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', totp_secret: secret, totp_enabled: false },
    update: { totp_secret: secret },
  });

  res.json({ secret, qr: qrDataUrl });
});

// ─── POST /api/admin/mfa/enable ─── Confirme avec un code TOTP puis active
router.post('/mfa/enable', requireSuperAdmin, async (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  if (!totp) { res.status(400).json({ error: 'Code TOTP requis' }); return; }

  const adminConfig = await prisma.adminConfig.findUnique({ where: { id: 'global' } });
  if (!adminConfig?.totp_secret) {
    res.status(400).json({ error: 'Aucun secret provisoire. Lancez /mfa/setup d\'abord.' }); return;
  }

  const valid = await totpVerify(totp.replace(/\s/g, ''), adminConfig.totp_secret);
  if (!valid) { res.status(401).json({ error: 'Code incorrect — vérifiez votre application authenticator' }); return; }

  await prisma.adminConfig.update({ where: { id: 'global' }, data: { totp_enabled: true } });
  res.json({ ok: true });
});

// ─── DELETE /api/admin/mfa ─── Désactive le MFA (code TOTP requis pour confirmer)
router.delete('/mfa', requireSuperAdmin, async (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  if (!totp) { res.status(400).json({ error: 'Code TOTP requis pour désactiver' }); return; }

  const adminConfig = await prisma.adminConfig.findUnique({ where: { id: 'global' } });
  if (!adminConfig?.totp_enabled || !adminConfig.totp_secret) {
    res.status(400).json({ error: 'MFA non activé' }); return;
  }

  const valid = await totpVerify(totp.replace(/\s/g, ''), adminConfig.totp_secret);
  if (!valid) { res.status(401).json({ error: 'Code incorrect' }); return; }

  await prisma.adminConfig.update({ where: { id: 'global' }, data: { totp_enabled: false, totp_secret: null } });
  res.json({ ok: true });
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

// ─── DELETE /api/admin/users/:id ───
router.delete('/users/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.userApp.delete({ where: { id } });
  res.json({ ok: true });
});

// ─── GET /api/admin/promo-codes ───
router.get('/promo-codes', requireSuperAdmin, async (_req: Request, res: Response) => {
  const codes = await prisma.promoCode.findMany({ orderBy: { created_at: 'desc' } });
  res.json(codes);
});

// ─── POST /api/admin/promo-codes ───
router.post('/promo-codes', requireSuperAdmin, async (req: Request, res: Response) => {
  const { code, months, max_uses, expires_at } = req.body as {
    code?: string; months?: number; max_uses?: number; expires_at?: string | null;
  };

  if (!code || typeof code !== 'string' || code.trim() === '') {
    res.status(400).json({ error: 'Code requis' });
    return;
  }

  const normalized = code.trim().toUpperCase();
  const existing = await prisma.promoCode.findUnique({ where: { code: normalized } });
  if (existing) {
    res.status(409).json({ error: 'Ce code existe déjà' });
    return;
  }

  const created = await prisma.promoCode.create({
    data: {
      id: uuidv4(),
      code: normalized,
      months: months ?? 1,
      max_uses: max_uses ?? 1,
      expires_at: expires_at ? new Date(expires_at) : null,
    },
  });

  res.json(created);
});

// ─── DELETE /api/admin/promo-codes/:id ───
router.delete('/promo-codes/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.promoCode.delete({ where: { id } });
  res.json({ ok: true });
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
