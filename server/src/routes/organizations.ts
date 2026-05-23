import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonValue } from '@prisma/client/runtime/library';
import prisma from '../prisma/client';
import { requireAuth, generateToken } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';

function serializeOrg(org: {
  id: string; name: string; logo_url: string; plan: string;
  max_admin_per_platform: number; access_review_delay_days: number;
  subscription_alert_days: number; enabled_modules: JsonValue; created_at: Date;
}) {
  return {
    id: org.id, name: org.name, logo_url: org.logo_url, plan: org.plan,
    max_admin_per_platform: org.max_admin_per_platform,
    access_review_delay_days: org.access_review_delay_days,
    subscription_alert_days: org.subscription_alert_days,
    enabled_modules: org.enabled_modules,
    created_at: org.created_at,
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

// POST /api/organizations/reset — supprimer toutes les données de l'org (sauf l'org et les utilisateurs)
router.post('/reset', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
