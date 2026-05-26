import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonValue } from '@prisma/client/runtime/library';
import prisma from '../prisma/client';
import { requireAuth, generateToken } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';

function serializeOrg(org: {
  id: string; name: string; logo_url: string; plan: string;
  plan_expires_at?: Date | null;
  max_admin_per_platform: number; access_review_delay_days: number;
  subscription_alert_days: number; enabled_modules: JsonValue; created_at: Date;
  alert_email_enabled?: boolean; alert_email_address?: string; alert_email_frequency?: string;
}) {
  return {
    id: org.id, name: org.name, logo_url: org.logo_url, plan: org.plan,
    plan_expires_at: org.plan_expires_at ? org.plan_expires_at.toISOString() : null,
    max_admin_per_platform: org.max_admin_per_platform,
    access_review_delay_days: org.access_review_delay_days,
    subscription_alert_days: org.subscription_alert_days,
    enabled_modules: org.enabled_modules,
    created_at: org.created_at,
    alert_email_enabled: org.alert_email_enabled ?? false,
    alert_email_address: org.alert_email_address ?? '',
    alert_email_frequency: org.alert_email_frequency ?? 'daily',
  };
}

const router = Router();

// GET /api/organizations — liste toutes les orgs de l'utilisateur connecté
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  // org principale + toutes les orgs via user_organizations
  const [mainUser, memberships] = await Promise.all([
    prisma.userApp.findUnique({ where: { id: userId }, include: { organization: true } }),
    prisma.userOrganization.findMany({
      where: { user_id: userId },
      include: { organization: true },
    }),
  ]);

  if (!mainUser) { res.status(404).json({ error: 'User not found' }); return; }

  // Dédupliquer : org principale + orgs additionnelles
  const orgsMap = new Map<string, { org: ReturnType<typeof serializeOrg>; role: string }>();
  orgsMap.set(mainUser.organization_id, {
    org: serializeOrg(mainUser.organization),
    role: mainUser.role,
  });
  for (const m of memberships) {
    if (!orgsMap.has(m.organization_id)) {
      orgsMap.set(m.organization_id, {
        org: serializeOrg(m.organization),
        role: m.role,
      });
    }
  }

  res.json(Array.from(orgsMap.values()));
});

// POST /api/organizations — créer une nouvelle organisation
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Le nom de l\'organisation est requis.' });
    return;
  }

  // Vérifier si le plan actuel autorise plusieurs organisations
  const currentOrg = await prisma.organization.findUnique({
    where: { id: req.user!.organizationId },
    select: { plan: true },
  });
  if (!currentOrg || currentOrg.plan === 'free') {
    const existingCount = await prisma.userOrganization.count({ where: { user_id: userId } });
    if (existingCount >= 1) {
      res.status(403).json({ error: 'Le plan gratuit est limité à 1 organisation. Passez à Pro pour en créer plusieurs.' });
      return;
    }
  }

  const orgId = uuidv4();
  const membershipId = uuidv4();

  const org = await prisma.organization.create({
    data: { id: orgId, name: name.trim() },
  });

  // Lier l'utilisateur à cette nouvelle org via user_organizations
  await prisma.userOrganization.create({
    data: { id: membershipId, user_id: userId, organization_id: orgId, role: 'admin' },
  });

  const user = await prisma.userApp.findUnique({ where: { id: userId } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'organization.create',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: org.name,
    oldValue: {},
    newValue: { name: org.name },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json({ org: serializeOrg(org), role: 'admin', user: user ?? undefined });
});

// POST /api/organizations/:orgId/switch — switcher vers une org et obtenir un nouveau token
router.post('/:orgId/switch', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { orgId } = req.params;

  const user = await prisma.userApp.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  // Vérifier que l'utilisateur appartient bien à cette org
  const isMainOrg = user.organization_id === orgId;
  const membership = isMainOrg
    ? null
    : await prisma.userOrganization.findUnique({
        where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
        include: { organization: true },
      });

  if (!isMainOrg && !membership) {
    res.status(403).json({ error: 'Vous n\'avez pas accès à cette organisation.' });
    return;
  }

  const org = isMainOrg ? user.organization : membership!.organization;
  const role = isMainOrg ? user.role : membership!.role;

  const token = generateToken({
    userId: user.id,
    organizationId: orgId,
    email: user.email,
    role,
  });

  await prisma.userApp.update({ where: { id: userId }, data: { last_login_at: new Date() } });

  await createAuditEntry({
    organizationId: orgId,
    actor: user.email,
    action: 'organization.switch',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: org.name,
    oldValue: { organization_id: user.organization_id },
    newValue: { organization_id: orgId },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({
    token,
    user: {
      id: user.id,
      organization_id: orgId,
      full_name: user.full_name,
      email: user.email,
      role,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
    organization: {
      id: org.id, name: org.name, logo_url: org.logo_url, plan: org.plan,
      max_admin_per_platform: org.max_admin_per_platform,
      access_review_delay_days: org.access_review_delay_days,
      subscription_alert_days: org.subscription_alert_days,
      enabled_modules: org.enabled_modules,
      created_at: org.created_at,
    },
  });
});

// DELETE /api/organizations/me — RGPD Art. 17 : suppression complète de l'organisation et de ses données
// Réservé au owner/admin. Requiert confirmation du mot de passe (ou JWT pour les comptes OAuth).
// Trace une entrée audit super-admin avant la suppression.
router.delete('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'owner') {
    res.status(403).json({ error: 'Réservé aux administrateurs.' });
    return;
  }

  const { password } = req.body as { password?: string };
  const orgId = req.user!.organizationId;

  const user = await prisma.userApp.findUnique({ where: { id: req.user!.userId }, select: { password_hash: true, full_name: true, email: true } });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable.' }); return; }

  if (user.password_hash) {
    if (!password) {
      res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression de l\'organisation.' });
      return;
    }
    const valid = await import('bcrypt').then((b) => b.compare(password, user.password_hash!));
    if (!valid) {
      res.status(403).json({ error: 'Mot de passe incorrect.' });
      return;
    }
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });

  // Audit entry before deletion (will be cascade-deleted with the org, but logged in super-admin context first)
  await prisma.auditTrail.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      actor: user.email,
      action: 'gdpr.delete_request',
      target_type: 'organization',
      target_id: orgId,
      target_label: org?.name ?? orgId,
      old_value: {},
      new_value: { requested_by: user.email, requested_at: new Date().toISOString() },
      ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '',
      user_agent: req.headers['user-agent'] ?? '',
    },
  });

  // Hard-delete — Prisma onDelete: Cascade handles all related tables
  await prisma.organization.delete({ where: { id: orgId } });

  res.json({ message: 'Organisation et toutes ses données supprimées conformément à l\'Art. 17 RGPD.' });
});

// PATCH /api/organizations/members/:userId/role — modifier le rôle d'un membre (admin uniquement)
router.patch('/members/:userId/role', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'owner') {
    res.status(403).json({ error: 'Réservé aux administrateurs.' });
    return;
  }

  const { userId } = req.params;
  const { role } = req.body as { role?: string };
  const VALID_ROLES = ['owner', 'admin', 'security_manager', 'reviewer', 'auditor', 'editor', 'viewer'];

  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Rôle invalide. Valeurs acceptées : ${VALID_ROLES.join(', ')}` });
    return;
  }

  const orgId = req.user!.organizationId;

  // Find the user in this org (main org or membership)
  const target = await prisma.userApp.findFirst({
    where: { id: userId, organization_id: orgId },
    select: { id: true, full_name: true, email: true, role: true },
  });

  if (!target) {
    // Check secondary membership
    const membership = await prisma.userOrganization.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership) { res.status(404).json({ error: 'Utilisateur introuvable dans cette organisation.' }); return; }

    const oldRole = membership.role;
    await prisma.userOrganization.update({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
      data: { role },
    });
    const updatedUser = await prisma.userApp.findUnique({ where: { id: userId }, select: { full_name: true, email: true } });
    await createAuditEntry({
      organizationId: orgId,
      actor: req.user!.email,
      action: 'user.role_change',
      targetType: 'user',
      targetId: userId,
      targetLabel: updatedUser?.full_name ?? userId,
      oldValue: { role: oldRole },
      newValue: { role },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
    res.json({ id: userId, role });
    return;
  }

  const oldRole = target.role;
  await prisma.userApp.update({ where: { id: userId }, data: { role } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'user.role_change',
    targetType: 'user',
    targetId: userId,
    targetLabel: target.full_name,
    oldValue: { role: oldRole },
    newValue: { role },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ id: userId, role });
});

// POST /api/organizations/reset — supprimer toutes les données de l'org (sauf l'org et les utilisateurs)
router.post('/reset', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Réservé aux admins uniquement
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Réservé aux administrateurs.' });
    return;
  }

  // Vérification du mot de passe (uniquement pour les comptes non-OAuth)
  const { password } = req.body as { password?: string };
  const user = await prisma.userApp.findUnique({ where: { id: req.user!.userId }, select: { password_hash: true } });
  if (user?.password_hash) {
    // Compte email/password : mot de passe obligatoire
    if (!password) {
      res.status(400).json({ error: 'Mot de passe requis pour confirmer la réinitialisation.' });
      return;
    }
    const valid = await import('bcrypt').then(b => b.compare(password, user.password_hash!));
    if (!valid) {
      res.status(403).json({ error: 'Mot de passe incorrect.' });
      return;
    }
  }
  // Compte OAuth (pas de password_hash) : le JWT suffit comme preuve d'identité

  const orgId = req.user!.organizationId;

  // Delete in dependency order to respect foreign key constraints
  await prisma.$transaction([
    prisma.auditTrail.deleteMany({ where: { organization_id: orgId } }),
    prisma.alert.deleteMany({ where: { organization_id: orgId } }),
    prisma.reviewItem.deleteMany({ where: { organization_id: orgId } }),
    prisma.reviewCampaign.deleteMany({ where: { organization_id: orgId } }),
    prisma.accessRight.deleteMany({ where: { organization_id: orgId } }),
    prisma.subscription.deleteMany({ where: { organization_id: orgId } }),
    prisma.networkFlow.deleteMany({ where: { organization_id: orgId } }),
    prisma.customEntry.deleteMany({ where: { module: { organization_id: orgId } } }),
    prisma.customModule.deleteMany({ where: { organization_id: orgId } }),
    prisma.category.deleteMany({ where: { organization_id: orgId } }),
    prisma.system.deleteMany({ where: { organization_id: orgId } }),
    prisma.platform.deleteMany({ where: { organization_id: orgId } }),
    prisma.member.deleteMany({ where: { organization_id: orgId } }),
  ]);

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'organization.reset',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: 'Réinitialisation des données',
    oldValue: {},
    newValue: { reset: true },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ success: true });
});

export default router;
