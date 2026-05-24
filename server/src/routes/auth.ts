import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { JsonValue } from '@prisma/client/runtime/library';
import prisma from '../prisma/client';
import { requireAuth, generateToken } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { getLimits } from '../services/plan.service';
import { config } from '../config';
import { authLimiter } from '../middleware/rateLimiter';

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

  const token = generateToken({
    userId: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role,
  });

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

  const token = generateToken({
    userId: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role,
  });

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
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.userApp.findUnique({
    where: { id: req.user!.userId },
    include: { organization: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
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
  });
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

  res.json(serializeOrg(updated));
});

// POST /api/auth/onboarding — save onboarding data and mark org as completed
router.post('/onboarding', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { org_name, sector, size, objective, alert_email, alert_email_enabled } = req.body;

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(org_name && { name: String(org_name).slice(0, 100) }),
      ...(alert_email && { alert_email_address: String(alert_email).slice(0, 254) }),
      ...(alert_email_enabled !== undefined && { alert_email_enabled: Boolean(alert_email_enabled) }),
      onboarding_completed: true,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'organization.onboarding_completed',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: updated.name,
    oldValue: {},
    newValue: { sector, size, objective },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(serializeOrg(updated));
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

  const token = generateToken({
    userId: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role,
  });

  // Redirect to frontend callback with token
  res.redirect(`${FRONTEND}/oauth/callback?token=${encodeURIComponent(token)}`);
}

// ─── Google OAuth ───
// GET /api/auth/oauth/google
router.get('/oauth/google', (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(501).json({ error: 'Google OAuth non configuré' }); return; }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${config.apiUrl}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/oauth/google/callback
router.get('/oauth/google/callback', async (req: Request, res: Response): Promise<void> => {
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

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${config.apiUrl}/api/auth/oauth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    response_mode: 'query',
  });
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
});

// GET /api/auth/oauth/microsoft/callback
router.get('/oauth/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
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

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${config.apiUrl}/api/auth/oauth/github/callback`,
    scope: 'read:user user:email',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/oauth/github/callback
router.get('/oauth/github/callback', async (req: Request, res: Response): Promise<void> => {
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

// POST /api/auth/test-email — envoie un email de test à l'adresse configurée
router.post('/test-email', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    await sendAlertEmail({
      to,
      orgName: org?.name ?? 'Tracix',
      alerts: [{ type: 'no_mfa_on_admin', severity: 'critical', message: 'Ceci est un email de test — configuration Resend opérationnelle ✓', source_label: 'Test' }],
      frontendUrl: config.frontendUrl,
    });
    res.json({ success: true, sent_to: to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    res.status(500).json({ error: `Échec envoi : ${msg}` });
  }
});

export default router;
