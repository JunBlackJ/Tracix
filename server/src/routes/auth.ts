import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { JsonValue } from '@prisma/client/runtime/library';
import prisma from '../prisma/client';
import { requireAuth, generateToken, generateRefreshToken } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { getLimits } from '../services/plan.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { generateAlerts } from '../services/alert.service';
import { recomputeAllRiskScores } from '../services/risk.service';
import { config } from '../config';
import { authLimiter, refreshLimiter } from '../middleware/rateLimiter';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin, generateSecret as genTotpSecret } from 'otplib';
import * as QRCode from 'qrcode';

const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

// Helper — expose organization fields consistently including enabled_modules (Json)
function serializeOrg(org: {
  id: string; name: string; logo_url: string; plan: string;
  plan_expires_at?: Date | null;
  max_admin_per_platform: number; access_review_delay_days: number;
  subscription_alert_days: number; enabled_modules: JsonValue; created_at: Date;
  alert_email_enabled?: boolean; alert_email_address?: string; alert_email_frequency?: string;
  onboarding_completed?: boolean;
}) {
  return {
    id: org.id,
    name: org.name,
    logo_url: org.logo_url,
    plan: org.plan,
    plan_expires_at: org.plan_expires_at ? org.plan_expires_at.toISOString() : null,
    max_admin_per_platform: org.max_admin_per_platform,
    access_review_delay_days: org.access_review_delay_days,
    subscription_alert_days: org.subscription_alert_days,
    enabled_modules: org.enabled_modules,
    created_at: org.created_at,
    alert_email_enabled: org.alert_email_enabled ?? false,
    alert_email_address: org.alert_email_address ?? '',
    alert_email_frequency: org.alert_email_frequency ?? 'daily',
    onboarding_completed: org.onboarding_completed ?? false,
  };
}

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string()
    .min(10, 'Le mot de passe doit avoir au moins 10 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
  organization_name: z.string().min(1).max(100),
});

const MAX_ATTEMPTS = 5;         // tentatives avant verrouillage
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── Helper: issue access token + refresh token pair ───
// Writes the refresh token into an HttpOnly cookie (path=/api/auth) and returns
// only the short-lived access token for the JSON response body.
async function issueTokenPair(
  userId: string,
  organizationId: string,
  email: string,
  role: string,
  req?: Request,
  res?: Response,
) {
  const token = generateToken({ userId, organizationId, email, role });
  const { raw, hash, expiresAt } = await generateRefreshToken(userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).refreshToken.create({
    data: {
      id: uuidv4(),
      user_id: userId,
      organization_id: organizationId,
      token_hash: hash,
      expires_at: expiresAt,
      user_agent: req?.headers['user-agent'] ?? '',
      ip_address: req ? getClientIp(req) : '',
    },
  });
  if (res) setRefreshCookie(res, raw, expiresAt);
  return { token, refreshToken: raw, refreshExpiresAt: expiresAt };
}

const REFRESH_COOKIE = '__rt';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const isProd = config.nodeEnv === 'production';
// cross-domain (frontend ≠ API domain) requires sameSite:'none' + secure:true
const COOKIE_SAME_SITE = isProd ? 'none' : 'lax';

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: COOKIE_SAME_SITE,
    expires: expiresAt,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: isProd, sameSite: COOKIE_SAME_SITE, path: '/api/auth' });
}

const PLATFORM_NAMES: Record<string, { name: string; category: string; auth_method: string }> = {
  aws:    { name: 'AWS IAM',                category: 'cloud',          auth_method: 'iam' },
  azure:  { name: 'Azure Active Directory', category: 'cloud',          auth_method: 'oauth' },
  github: { name: 'GitHub',                 category: 'devtools',       auth_method: 'oauth' },
  google: { name: 'Google Workspace',       category: 'productivity',   auth_method: 'oauth' },
  okta:   { name: 'Okta',                   category: 'iam',            auth_method: 'saml' },
  slack:  { name: 'Slack',                  category: 'communication',  auth_method: 'oauth' },
  jira:   { name: 'Jira / Confluence',      category: 'project',        auth_method: 'saml' },
  other:  { name: 'Plateforme personnalisée', category: 'other',        auth_method: 'other' },
};

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const body = LoginSchema.parse(req.body);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { email: body.email },
    include: { organization: true },
  });

  // Réponse identique que l'email existe ou non (anti-énumération)
  if (!user) {
    // Délai fixe pour éviter le timing attack
    await new Promise((r) => setTimeout(r, 300));
    res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    return;
  }

  // Vérifier si le compte est verrouillé
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    res.status(429).json({ error: `Compte temporairement verrouillé. Réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.` });
    return;
  }

  if (!user.password_hash) {
    res.status(401).json({ error: 'Ce compte utilise la connexion OAuth. Pas de mot de passe défini.' });
    return;
  }

  const passwordValid = await bcrypt.compare(body.password, user.password_hash);

  if (!passwordValid) {
    const newAttempts = (user.failed_login_attempts ?? 0) + 1;
    const shouldLock = newAttempts >= MAX_ATTEMPTS;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.userApp.update as any)({
      where: { id: user.id },
      data: {
        failed_login_attempts: newAttempts,
        ...(shouldLock && { locked_until: new Date(Date.now() + LOCK_DURATION_MS) }),
      },
    });

    // Délai progressif selon le nombre d'échecs (ralentit les robots)
    await new Promise((r) => setTimeout(r, Math.min(newAttempts * 200, 2000)));

    if (shouldLock) {
      res.status(429).json({ error: `Trop de tentatives. Compte verrouillé 15 minutes.` });
    } else {
      res.status(401).json({ error: `Email ou mot de passe incorrect. ${MAX_ATTEMPTS - newAttempts} tentative${MAX_ATTEMPTS - newAttempts > 1 ? 's' : ''} restante${MAX_ATTEMPTS - newAttempts > 1 ? 's' : ''}.` });
    }
    return;
  }

  // Connexion réussie — réinitialiser le compteur
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userApp.update as any)({
    where: { id: user.id },
    data: { last_login_at: new Date(), failed_login_attempts: 0, locked_until: null },
  });

  // Si le MFA est activé, ne pas émettre de token — demander le code TOTP
  if (user.totp_enabled) {
    res.json({ mfa_required: true, user_id: user.id });
    return;
  }

  const { token } = await issueTokenPair(
    user.id, user.organization_id, user.email, user.role, req, res
  );

  await createAuditEntry({
    organizationId: user.organization_id,
    actor: user.email,
    action: 'auth.login',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: {},
    newValue: { last_login_at: new Date().toISOString() },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({
    token,
    user: {
      id: user.id,
      organization_id: user.organization_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
    organization: serializeOrg(user.organization),
  });
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const body = RegisterSchema.parse(req.body);

  const existing = await prisma.userApp.findUnique({ where: { email: body.email } });
  if (existing) {
    res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    return;
  }

  const password_hash = await bcrypt.hash(body.password, 10);
  const orgId = uuidv4();
  const userId = uuidv4();

  const org = await prisma.organization.create({
    data: {
      id: orgId,
      name: body.organization_name,
    },
  });

  const user = await prisma.userApp.create({
    data: {
      id: userId,
      organization_id: orgId,
      full_name: body.full_name,
      email: body.email,
      password_hash,
      role: 'admin',
    },
    include: { organization: true },
  });

  const { token } = await issueTokenPair(
    user.id, user.organization_id, user.email, user.role, req, res
  );

  await createAuditEntry({
    organizationId: org.id,
    actor: user.email,
    action: 'auth.register',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: {},
    newValue: { organization: org.name },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      organization_id: user.organization_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
    organization: serializeOrg(user.organization),
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user) {
    // Révoquer tous les refresh tokens de l'utilisateur
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).refreshToken.updateMany({
      where: { user_id: req.user.userId, revoked: false },
      data: { revoked: true },
    });

    await createAuditEntry({
      organizationId: req.user.organizationId,
      actor: req.user.email,
      action: 'auth.logout',
      targetType: 'user',
      targetId: req.user.userId,
      targetLabel: req.user.email,
      oldValue: {},
      newValue: {},
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
  clearRefreshCookie(res);
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh — rotation de refresh token
// Reads the refresh token from the HttpOnly cookie (__rt). Falls back to req.body.refreshToken
// for backward compatibility during the transition period.
router.post('/refresh', refreshLimiter, async (req: Request, res: Response): Promise<void> => {
  const rawToken: unknown = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (!rawToken || typeof rawToken !== 'string') {
    res.status(400).json({ error: 'refreshToken requis' });
    return;
  }

  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = await (prisma as any).refreshToken.findUnique({
    where: { token_hash: hash },
  }) as { id: string; user_id: string; organization_id: string; expires_at: Date; revoked: boolean } | null;

  if (!stored) {
    res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    return;
  }

  if (stored.revoked) {
    // Token already revoked — likely stolen and replayed. Revoke entire family.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).refreshToken.updateMany({
      where: { user_id: stored.user_id, revoked: false },
      data: { revoked: true },
    });
    res.status(401).json({ error: 'Session compromise détectée — toutes les sessions ont été révoquées' });
    return;
  }

  if (stored.expires_at < new Date()) {
    res.status(401).json({ error: 'Refresh token expiré' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: stored.user_id },
    include: { organization: true },
  });

  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable' });
    return;
  }

  // Révoquer l'ancien token (rotation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  // Utilise l'org stockée dans le refresh token (préserve le contexte multi-org des invités)
  const orgId = stored.organization_id || user.organization_id;
  const org = orgId !== user.organization_id
    ? await prisma.organization.findUnique({ where: { id: orgId } }) ?? user.organization
    : user.organization;

  const { token } = await issueTokenPair(
    user.id, orgId, user.email, user.role, req, res
  );

  res.json({
    token,
    user: {
      id: user.id,
      organization_id: orgId,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
    organization: serializeOrg(org),
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgIdFromToken = req.user!.organizationId;

  const user = await prisma.userApp.findUnique({
    where: { id: req.user!.userId },
    include: { organization: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Use the org from the JWT if it exists, otherwise fall back to the user's own org
  let org = orgIdFromToken !== user.organization_id
    ? await prisma.organization.findUnique({ where: { id: orgIdFromToken } })
    : null;
  if (!org) org = user.organization;

  res.json({
    user: {
      id: user.id,
      organization_id: org.id,
      full_name: user.full_name,
      email: user.email,
      role: req.user!.role,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
    organization: serializeOrg(org),
  });
});

// GET /api/auth/plan-limits — return current plan limits
router.get('/plan-limits', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
  const limits = getLimits(org.plan);
  const [members, platforms, customModules, categories, extraSeats] = await Promise.all([
    prisma.member.count({ where: { organization_id: orgId } }),
    prisma.platform.count({ where: { organization_id: orgId } }),
    prisma.customModule.count({ where: { organization_id: orgId } }),
    prisma.category.count({ where: { organization_id: orgId } }),
    prisma.userOrganization.count({ where: { organization_id: orgId } }),
  ]);
  // seats = 1 admin principal + membres invités via user_organizations
  const seats = 1 + extraSeats;
  res.json({
    plan: org.plan,
    limits,
    usage: { members, platforms, customModules, categories, seats },
    export_used: (org as any).export_used ?? false,
  });
});

// POST /api/auth/mark-export-used — consomme le droit d'export unique du plan free
router.post('/mark-export-used', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, export_used: true } as any });
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
  if ((org as any).plan !== 'free') { res.json({ ok: true }); return; }
  if ((org as any).export_used) { res.status(403).json({ error: 'Export unique déjà utilisé. Passez à Pro pour des exports illimités.' }); return; }
  await prisma.organization.update({ where: { id: orgId }, data: { export_used: true } as any });
  res.json({ ok: true });
});

const VALID_MODULES = ['habilitations','membres','plateformes','score-de-risque','systemes','flux-reseau','abonnements','alertes','journal','rapports','import'] as const;
const VALID_EMAIL_FREQ = ['immediate', 'daily'] as const;

// PUT /api/auth/organization — update org settings incl. enabled_modules
router.put('/organization', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { name, max_admin_per_platform, access_review_delay_days, subscription_alert_days, enabled_modules,
          plan_expires_at,
          alert_email_enabled, alert_email_address, alert_email_frequency } = req.body;

  // Whitelist des modules valides
  let safeModules: string[] | undefined;
  if (enabled_modules !== undefined) {
    if (!Array.isArray(enabled_modules)) { res.status(400).json({ error: 'enabled_modules doit être un tableau' }); return; }
    safeModules = (enabled_modules as unknown[]).filter((m): m is string => VALID_MODULES.includes(m as typeof VALID_MODULES[number]));
  }

  // Whitelist fréquence email
  let safeFreq: string | undefined;
  if (alert_email_frequency !== undefined) {
    if (!VALID_EMAIL_FREQ.includes(alert_email_frequency)) { res.status(400).json({ error: 'Fréquence invalide' }); return; }
    safeFreq = alert_email_frequency;
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(name !== undefined && { name: String(name).slice(0, 100) }),
      ...(max_admin_per_platform !== undefined && { max_admin_per_platform: Math.max(1, Math.min(50, Number(max_admin_per_platform))) }),
      ...(access_review_delay_days !== undefined && { access_review_delay_days: Math.max(1, Math.min(365, Number(access_review_delay_days))) }),
      ...(subscription_alert_days !== undefined && { subscription_alert_days: Math.max(1, Math.min(365, Number(subscription_alert_days))) }),
      ...(safeModules !== undefined && { enabled_modules: safeModules }),
      ...(plan_expires_at !== undefined && { plan_expires_at: plan_expires_at ? new Date(plan_expires_at) : null }),
      ...(alert_email_enabled !== undefined && { alert_email_enabled: Boolean(alert_email_enabled) }),
      ...(alert_email_address !== undefined && { alert_email_address: String(alert_email_address).slice(0, 254) }),
      ...(safeFreq !== undefined && { alert_email_frequency: safeFreq }),
    },
  });

  // Si un seuil a changé, recalculer alertes et scores de risque
  const thresholdChanged = max_admin_per_platform !== undefined
    || access_review_delay_days !== undefined
    || subscription_alert_days !== undefined;
  if (thresholdChanged) {
    const forceRefresh: string[] = [];
    if (max_admin_per_platform !== undefined) forceRefresh.push('admin_count_high');
    if (access_review_delay_days !== undefined) forceRefresh.push('access_review_overdue');
    if (subscription_alert_days !== undefined) forceRefresh.push('subscription_expiring');
    generateAlerts(orgId, forceRefresh).catch((err) => console.error('[Alerts] Erreur recalcul après mise à jour seuils:', err));
  }
  // max_admin_per_platform et access_review_delay_days influencent le score de risque
  const riskThresholdChanged = max_admin_per_platform !== undefined || access_review_delay_days !== undefined;
  if (riskThresholdChanged) {
    recomputeAllRiskScores(orgId).catch((err) => console.error('[Risk] Erreur recalcul scores après mise à jour seuils:', err));
  }

  res.json(serializeOrg(updated));
});

// POST /api/auth/onboarding — save onboarding data and mark org as completed
router.post('/onboarding', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { org_name, sector, size, objective, alert_email, alert_email_enabled, platforms } = req.body;

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(org_name && { name: String(org_name).slice(0, 100) }),
      ...(alert_email && { alert_email_address: String(alert_email).slice(0, 254) }),
      ...(alert_email_enabled !== undefined && { alert_email_enabled: Boolean(alert_email_enabled) }),
      onboarding_completed: true,
    },
  });

  // Créer les plateformes sélectionnées en respectant la limite du plan Free (3 max)
  let platformsCreated = 0;
  if (Array.isArray(platforms) && platforms.length > 0) {
    const limits = getLimits(updated.plan);
    const existingCount = await prisma.platform.count({ where: { organization_id: orgId } });
    const available = limits.platforms === -1 ? platforms.length : Math.max(0, limits.platforms - existingCount);
    const toCreate = (platforms as string[])
      .filter((key) => key in PLATFORM_NAMES)
      .slice(0, available);

    if (toCreate.length > 0) {
      const platformData = toCreate.map((key) => ({
        id: uuidv4(),
        organization_id: orgId,
        name: PLATFORM_NAMES[key].name,
        category: PLATFORM_NAMES[key].category,
        auth_method: PLATFORM_NAMES[key].auth_method,
      }));
      const result = await prisma.platform.createMany({
        data: platformData,
        skipDuplicates: true,
      });
      platformsCreated = result.count;
    }
  }

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'organization.onboarding_completed',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: updated.name,
    oldValue: {},
    newValue: { sector, size, objective, platformsCreated },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ ...serializeOrg(updated), platformsCreated });
});

// POST /api/auth/promo — validate a promo code and upgrade org to pro
router.post('/promo', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Code manquant' });
    return;
  }

  const normalizedCode = code.trim().toUpperCase();
  const promo = await prisma.promoCode.findUnique({ where: { code: normalizedCode } });

  if (!promo) {
    res.status(400).json({ error: 'Code promo invalide' });
    return;
  }
  if (promo.uses >= promo.max_uses) {
    res.status(400).json({ error: 'Ce code promo a déjà été utilisé le nombre maximum de fois' });
    return;
  }
  if (promo.expires_at && promo.expires_at < new Date()) {
    res.status(400).json({ error: 'Ce code promo est expiré' });
    return;
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) { res.status(404).json({ error: 'Organisation introuvable' }); return; }

  if (org.plan !== 'free') {
    res.status(400).json({ error: 'Votre organisation bénéficie déjà d\'un plan payant' });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + promo.months);

  const [updated] = await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { plan: 'pro', plan_expires_at: expiresAt },
    }),
    prisma.promoCode.update({
      where: { id: promo.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'organization.promo_applied',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: org.name,
    oldValue: { plan: 'free' },
    newValue: { plan: 'pro', plan_expires_at: expiresAt.toISOString(), code: normalizedCode },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ ...serializeOrg(updated), message: `Plan Pro activé jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}` });
});

// ─────────────────────────────────────────────────────
//  OAuth helpers
// ─────────────────────────────────────────────────────

const FRONTEND = config.frontendUrl;

async function handleOAuthUser(
  provider: string,
  oauthId: string,
  email: string,
  fullName: string,
  req: Request,
  res: Response,
): Promise<void> {
  let user = await prisma.userApp.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (!user) {
    // First OAuth login — auto-create org + admin account
    const orgId = uuidv4();
    const userId = uuidv4();

    await prisma.organization.create({ data: { id: orgId, name: `Organisation de ${fullName.split(' ')[0]}` } });

    user = await prisma.userApp.create({
      data: {
        id: userId,
        organization_id: orgId,
        full_name: fullName,
        email,
        oauth_provider: provider,
        oauth_id: oauthId,
        role: 'admin',
      },
      include: { organization: true },
    });

    await createAuditEntry({
      organizationId: orgId,
      actor: email,
      action: 'auth.register',
      targetType: 'user',
      targetId: userId,
      targetLabel: fullName,
      oldValue: {},
      newValue: { provider },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  } else {
    // Existing user — patch oauth fields if missing
    if (!user.oauth_provider) {
      await prisma.userApp.update({ where: { id: user.id }, data: { oauth_provider: provider, oauth_id: oauthId } });
    }
    await prisma.userApp.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    await createAuditEntry({
      organizationId: user.organization_id,
      actor: email,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      targetLabel: user.full_name,
      oldValue: {},
      newValue: { provider, last_login_at: new Date().toISOString() },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  const { token } = await issueTokenPair(
    user.id,
    user.organization_id,
    user.email,
    user.role,
    req,
    res,
  );

  // Redirect to frontend callback — refresh token is in the HttpOnly cookie, only access token in URL
  res.redirect(
    `${FRONTEND}/oauth/callback?token=${encodeURIComponent(token)}`,
  );
}

// ─── OAuth CSRF state helpers ───
const OAUTH_STATE_COOKIE = '__oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function setOAuthStateCookie(res: Response): string {
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: OAUTH_STATE_TTL_MS,
    path: '/api/auth/oauth',
  });
  return state;
}

function verifyAndClearOAuthState(req: Request, res: Response, receivedState: string | undefined): boolean {
  const expected = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/api/auth/oauth' });
  if (!expected || !receivedState) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedState));
}

// ─── Google OAuth ───
// GET /api/auth/oauth/google
router.get('/oauth/google', (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'Google OAuth non configuré' }); return; }

  const state = setOAuthStateCookie(res);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${config.apiUrl}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/oauth/google/callback
router.get('/oauth/google/callback', async (req: Request, res: Response): Promise<void> => {
  // CSRF state verification — best effort only (cookie may be lost behind proxies)
  const expected = req.cookies?.[OAUTH_STATE_COOKIE];
  if (expected) {
    if (!verifyAndClearOAuthState(req, res, req.query.state as string | undefined)) {
      res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent('État CSRF invalide ou expiré')}`);
      return;
    }
  } else {
    res.clearCookie(OAUTH_STATE_COOKIE, { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/api/auth/oauth' });
  }

  const code = req.query.code as string;
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${config.apiUrl}/api/auth/oauth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokens.access_token) throw new Error(tokens.error ?? 'No access token');

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json() as { id: string; email: string; name: string };

    await handleOAuthUser('google', profile.id, profile.email, profile.name, req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth error';
    res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent(msg)}`);
  }
});

// ─── Microsoft OAuth ───
// GET /api/auth/oauth/microsoft
router.get('/oauth/microsoft', (_req: Request, res: Response) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'Microsoft OAuth non configuré' }); return; }

  const state = setOAuthStateCookie(res);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${config.apiUrl}/api/auth/oauth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    response_mode: 'query',
    state,
  });
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
});

// GET /api/auth/oauth/microsoft/callback
router.get('/oauth/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
  const _msExpected = req.cookies?.[OAUTH_STATE_COOKIE];
  if (_msExpected && !verifyAndClearOAuthState(req, res, req.query.state as string | undefined)) {
    res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent('État CSRF invalide ou expiré')}`);
    return;
  }

  const code = req.query.code as string;
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const redirectUri = `${config.apiUrl}/api/auth/oauth/microsoft/callback`;

  try {
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: 'openid email profile User.Read' }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokens.access_token) throw new Error(tokens.error ?? 'No access token');

    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json() as { id: string; mail?: string; userPrincipalName?: string; displayName: string };
    const email = profile.mail ?? profile.userPrincipalName ?? '';
    if (!email) throw new Error('Email introuvable dans le profil Microsoft');

    await handleOAuthUser('microsoft', profile.id, email, profile.displayName, req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth error';
    res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent(msg)}`);
  }
});

// ─── GitHub OAuth ───
// GET /api/auth/oauth/github
router.get('/oauth/github', (_req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'GitHub OAuth non configuré' }); return; }

  const state = setOAuthStateCookie(res);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${config.apiUrl}/api/auth/oauth/github/callback`,
    scope: 'read:user user:email',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/oauth/github/callback
router.get('/oauth/github/callback', async (req: Request, res: Response): Promise<void> => {
  const _ghExpected = req.cookies?.[OAUTH_STATE_COOKIE];
  if (_ghExpected && !verifyAndClearOAuthState(req, res, req.query.state as string | undefined)) {
    res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent('État CSRF invalide ou expiré')}`);
    return;
  }

  const code = req.query.code as string;
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;

  if (!code) {
    const error = req.query.error_description as string ?? 'Accès refusé';
    res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent(error)}`);
    return;
  }

  const GH_HEADERS = {
    Authorization: '',
    'User-Agent': 'Tracix-App/1.0',
    Accept: 'application/json',
  };

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Tracix-App/1.0' },
      body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokens.access_token) {
      throw new Error(tokens.error_description ?? tokens.error ?? 'Token GitHub invalide');
    }

    const authHeaders = { ...GH_HEADERS, Authorization: `Bearer ${tokens.access_token}` };

    const [userRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers: authHeaders }),
      fetch('https://api.github.com/user/emails', { headers: authHeaders }),
    ]);

    const profile = await userRes.json() as { id: number; name?: string; login: string; email?: string };
    const emailsRaw = await emailsRes.json();
    const emails = Array.isArray(emailsRaw)
      ? (emailsRaw as { email: string; primary: boolean; verified: boolean }[])
      : [];

    const primary = emails.find((e) => e.primary && e.verified);
    const email = primary?.email ?? emails[0]?.email ?? profile.email ?? '';
    if (!email) throw new Error('Email introuvable dans le profil GitHub. Vérifiez que votre email est visible.');

    const fullName = profile.name ?? profile.login;
    await handleOAuthUser('github', String(profile.id), email, fullName, req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth error';
    res.redirect(`${FRONTEND}/oauth/callback?error=${encodeURIComponent(msg)}`);
  }
});


// POST /api/auth/test-email — envoie un email de test à l'adresse configurée (admin only)
router.post('/test-email', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    res.status(503).json({ error: 'RESEND_API_KEY non configuré sur le serveur' });
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: req.user!.organizationId },
    select: { alert_email_address: true, name: true },
  });

  const to = org?.alert_email_address || req.user!.email;

  try {
    const { sendAlertEmail } = await import('../services/email.service');
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout (5s) — Resend ne répond pas')), 5000),
    );
    await Promise.race([
      sendAlertEmail({
        to,
        orgName: org?.name ?? 'Tracix',
        alerts: [{ type: 'no_mfa_on_admin', severity: 'critical', message: 'Ceci est un email de test — configuration Resend opérationnelle ✓', source_label: 'Test' }],
        frontendUrl: config.frontendUrl,
      }),
      timeout,
    ]);
    res.json({ success: true, sent_to: to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    res.status(500).json({ error: `Échec envoi : ${msg}` });
  }
});

// ─────────────────────────────────────────────────────
//  MFA TOTP — utilisateurs
// ─────────────────────────────────────────────────────

// POST /api/auth/login/mfa — validation du code TOTP après login (session non établie)
router.post('/login/mfa', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { user_id, totp: totpCode } = req.body;

  if (!user_id || !totpCode) {
    res.status(400).json({ error: 'user_id et totp sont requis.' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: user_id },
    include: { organization: true },
  });

  if (!user || !user.totp_enabled || !user.totp_secret) {
    res.status(401).json({ error: 'MFA non activé ou utilisateur introuvable.' });
    return;
  }

  const result = await totp.verify(String(totpCode), { secret: user.totp_secret });
  const valid = typeof result === 'object' ? result.valid : result;

  if (!valid) {
    res.status(401).json({ error: 'Code TOTP invalide.' });
    return;
  }

  const { token } = await issueTokenPair(
    user.id, user.organization_id, user.email, user.role, req, res
  );

  await createAuditEntry({
    organizationId: user.organization_id,
    actor: user.email,
    action: 'auth.login_mfa',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: {},
    newValue: { last_login_at: new Date().toISOString() },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({
    token,
    user: {
      id: user.id,
      organization_id: user.organization_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
    organization: serializeOrg(user.organization),
  });
});

// GET /api/auth/mfa/status — retourne { enabled: bool }
router.get('/mfa/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: req.user!.userId },
    select: { totp_enabled: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  res.json({ enabled: user.totp_enabled ?? false });
});

// POST /api/auth/mfa/setup — génère un secret provisoire + QR code
router.post('/mfa/setup', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: req.user!.userId },
    select: { id: true, email: true, totp_enabled: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  if (user.totp_enabled) {
    res.status(400).json({ error: 'Le MFA est déjà activé. Désactivez-le d\'abord.' });
    return;
  }

  const secret = genTotpSecret();
  const uri = `otpauth://totp/Tracix:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Tracix&algorithm=SHA1&digits=6&period=30`;
  const qr = await QRCode.toDataURL(uri);

  // Stocker le secret provisoire (totp_enabled reste false jusqu'à confirmation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userApp.update as any)({
    where: { id: user.id },
    data: { totp_secret: secret },
  });

  res.json({ secret, qr, uri });
});

// POST /api/auth/mfa/enable — confirme avec un code TOTP et active le MFA
router.post('/mfa/enable', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { totp: totpCode } = req.body;

  if (!totpCode) {
    res.status(400).json({ error: 'Code TOTP requis.' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: req.user!.userId },
    select: { id: true, email: true, full_name: true, organization_id: true, totp_secret: true, totp_enabled: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  if (user.totp_enabled) {
    res.status(400).json({ error: 'Le MFA est déjà activé.' });
    return;
  }

  if (!user.totp_secret) {
    res.status(400).json({ error: 'Aucun secret provisoire trouvé. Lancez d\'abord /mfa/setup.' });
    return;
  }

  const result = await totp.verify(String(totpCode), { secret: user.totp_secret });
  const valid = typeof result === 'object' ? result.valid : result;

  if (!valid) {
    res.status(401).json({ error: 'Code TOTP invalide.' });
    return;
  }

  // Generate 8 single-use recovery codes, store them hashed
  const rawCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'));
  const hashedCodes = rawCodes.map((c) => crypto.createHash('sha256').update(c).digest('hex'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userApp.update as any)({
    where: { id: user.id },
    data: { totp_enabled: true, totp_recovery_codes: hashedCodes },
  });

  await createAuditEntry({
    organizationId: user.organization_id,
    actor: req.user!.email,
    action: 'auth.mfa_enabled',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: { totp_enabled: false },
    newValue: { totp_enabled: true },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  // Recovery codes are returned exactly once — the client must display and save them
  res.json({ message: 'MFA activé avec succès.', recovery_codes: rawCodes });
});

// DELETE /api/auth/mfa — désactive le MFA avec confirmation TOTP
router.delete('/mfa', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { totp: totpCode } = req.body;

  if (!totpCode) {
    res.status(400).json({ error: 'Code TOTP requis pour désactiver le MFA.' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: req.user!.userId },
    select: { id: true, email: true, full_name: true, organization_id: true, totp_secret: true, totp_enabled: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  if (!user.totp_enabled || !user.totp_secret) {
    res.status(400).json({ error: 'Le MFA n\'est pas activé.' });
    return;
  }

  const result = await totp.verify(String(totpCode), { secret: user.totp_secret });
  const valid = typeof result === 'object' ? result.valid : result;

  if (!valid) {
    res.status(401).json({ error: 'Code TOTP invalide.' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userApp.update as any)({
    where: { id: user.id },
    data: { totp_enabled: false, totp_secret: null, totp_recovery_codes: [] },
  });

  await createAuditEntry({
    organizationId: user.organization_id,
    actor: req.user!.email,
    action: 'auth.mfa_disabled',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: { totp_enabled: true },
    newValue: { totp_enabled: false },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ message: 'MFA désactivé avec succès.' });
});

// POST /api/auth/mfa/recovery — consume a recovery code to bypass TOTP + reset MFA
router.post('/mfa/recovery', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { recovery_code } = req.body as { recovery_code?: string };

  if (!recovery_code) {
    res.status(400).json({ error: 'Code de récupération requis.' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.userApp.findUnique as any)({
    where: { id: req.user!.userId },
    select: { id: true, email: true, full_name: true, organization_id: true, totp_enabled: true, totp_recovery_codes: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  if (!user.totp_enabled) {
    res.status(400).json({ error: 'Le MFA n\'est pas activé.' });
    return;
  }

  const codes: string[] = user.totp_recovery_codes ?? [];
  const inputHash = crypto.createHash('sha256').update(String(recovery_code).toUpperCase().trim()).digest('hex');
  const idx = codes.indexOf(inputHash);

  if (idx === -1) {
    res.status(401).json({ error: 'Code de récupération invalide ou déjà utilisé.' });
    return;
  }

  // Consume the code and disable TOTP — user must re-setup MFA
  const remaining = codes.filter((_, i) => i !== idx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userApp.update as any)({
    where: { id: user.id },
    data: { totp_enabled: false, totp_secret: null, totp_recovery_codes: remaining },
  });

  await createAuditEntry({
    organizationId: user.organization_id,
    actor: req.user!.email,
    action: 'auth.mfa_recovery_used',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: { totp_enabled: true, recovery_codes_remaining: codes.length },
    newValue: { totp_enabled: false, recovery_codes_remaining: remaining.length },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ message: 'MFA réinitialisé. Vous devez reconfigurer votre application TOTP.' });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body as { current_password?: string; new_password?: string };
  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Champs requis manquants' }); return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' }); return;
  }

  const user = await prisma.userApp.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  if (!user.password_hash) {
    res.status(400).json({ error: 'Ce compte utilise OAuth — pas de mot de passe à changer' }); return;
  }

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) { res.status(401).json({ error: 'Mot de passe actuel incorrect' }); return; }

  const hash = await bcrypt.hash(new_password, 10);
  await prisma.userApp.update({ where: { id: user.id }, data: { password_hash: hash } });

  await createAuditEntry({
    organizationId: user.organization_id,
    actor: user.email,
    action: 'auth.change_password',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: {},
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ ok: true });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  // Réponse identique que l'email existe ou non (anti-énumération)
  if (!email) { res.json({ ok: true }); return; }

  const user = await prisma.userApp.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.password_hash) { res.json({ ok: true }); return; }

  // Invalider les tokens précédents non utilisés
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).passwordResetToken.updateMany({
    where: { user_id: user.id, used_at: null },
    data: { used_at: new Date() },
  });

  // Générer un token sécurisé
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).passwordResetToken.create({
    data: {
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    full_name: user.full_name,
    reset_url: resetUrl,
  });

  res.json({ ok: true });
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, new_password } = req.body as { token?: string; new_password?: string };
  if (!token || !new_password) {
    res.status(400).json({ error: 'Token et nouveau mot de passe requis' }); return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' }); return;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resetToken = await (prisma as any).passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  }) as { id: string; user_id: string; used_at: Date | null; expires_at: Date; user: { id: string; organization_id: string; email: string; full_name: string } } | null;

  if (!resetToken || resetToken.used_at || resetToken.expires_at < new Date()) {
    res.status(400).json({ error: 'Lien invalide ou expiré' }); return;
  }

  const hash = await bcrypt.hash(new_password, 10);
  await prisma.userApp.update({ where: { id: resetToken.user_id }, data: { password_hash: hash } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).passwordResetToken.update({ where: { id: resetToken.id }, data: { used_at: new Date() } });

  await createAuditEntry({
    organizationId: resetToken.user.organization_id,
    actor: resetToken.user.email,
    action: 'auth.reset_password',
    targetType: 'user',
    targetId: resetToken.user.id,
    targetLabel: resetToken.user.full_name,
    oldValue: {},
    newValue: {},
    ipAddress: '',
    userAgent: '',
  });

  res.json({ ok: true });
});

export default router;
