import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { requireAuth, generateToken } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { getLimits } from '../services/plan.service';
import { config } from '../config';

const router = Router();

// ─── Helpers ───
function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function expiresAt(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// GET /api/invitations — liste les invitations actives de l'org
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const invitations = await prisma.invitation.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: 'desc' },
  });
  res.json(invitations);
});

// POST /api/invitations — créer un lien d'invitation
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { role, email } = req.body;

  if (!['viewer', 'editor'].includes(role)) {
    res.status(400).json({ error: 'Rôle invalide. Utilisez "viewer" ou "editor".' });
    return;
  }

  // Vérifier les limites de sièges
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) { res.status(404).json({ error: 'Organisation introuvable.' }); return; }

  const limits = getLimits(org.plan);

  if (!limits.invitationsEnabled) {
    res.status(403).json({ error: 'Les invitations sont disponibles à partir du plan Pro.' });
    return;
  }

  if (limits.seats !== -1) {
    const currentSeats = await prisma.userOrganization.count({ where: { organization_id: orgId } });
    const mainAdminCount = await prisma.userApp.count({ where: { organization_id: orgId } });
    const total = currentSeats + mainAdminCount;
    if (total >= limits.seats) {
      res.status(403).json({
        error: `Limite de ${limits.seats} sièges atteinte sur votre plan. Passez à Enterprise pour des sièges illimités.`,
      });
      return;
    }
  }

  const token = makeToken();
  const invitation = await prisma.invitation.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      created_by: req.user!.userId,
      email: email ?? null,
      role,
      token,
      expires_at: expiresAt(7),
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'invitation.create',
    targetType: 'invitation',
    targetId: invitation.id,
    targetLabel: email ?? `Lien ${role}`,
    oldValue: {},
    newValue: { role, email: email ?? null },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  const inviteUrl = `${config.frontendUrl}/rejoindre/${token}`;
  res.status(201).json({ ...invitation, invite_url: inviteUrl });
});

// DELETE /api/invitations/:id — révoquer une invitation
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const inv = await prisma.invitation.findUnique({ where: { id: req.params.id } });
  if (!inv || inv.organization_id !== orgId) {
    res.status(404).json({ error: 'Invitation introuvable.' });
    return;
  }
  await prisma.invitation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// GET /api/invitations/preview/:token — aperçu public sans auth (pour afficher l'org avant d'accepter)
router.get('/preview/:token', async (req: Request, res: Response): Promise<void> => {
  const inv = await prisma.invitation.findUnique({
    where: { token: req.params.token },
    include: { organization: true },
  });

  if (!inv) { res.status(404).json({ error: 'Invitation invalide ou expirée.' }); return; }
  if (inv.expires_at < new Date()) { res.status(410).json({ error: 'Cette invitation a expiré.' }); return; }
  if (inv.accepted_at) { res.status(409).json({ error: 'Cette invitation a déjà été utilisée.' }); return; }

  res.json({
    organization_name: inv.organization.name,
    role: inv.role,
    expires_at: inv.expires_at,
  });
});

// POST /api/invitations/accept/:token — accepter une invitation (crée ou connecte un compte)
router.post('/accept/:token', async (req: Request, res: Response): Promise<void> => {
  const { full_name, email, password } = req.body;
  const { token } = req.params;

  const inv = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!inv) { res.status(404).json({ error: 'Invitation invalide.' }); return; }
  if (inv.expires_at < new Date()) { res.status(410).json({ error: 'Cette invitation a expiré.' }); return; }
  if (inv.accepted_at) { res.status(409).json({ error: 'Cette invitation a déjà été utilisée.' }); return; }

  let user = await prisma.userApp.findUnique({ where: { email } });

  if (!user) {
    // Créer un compte
    if (!full_name || !password || password.length < 10 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      res.status(400).json({ error: 'Mot de passe requis : 10 caractères min, 1 majuscule, 1 chiffre.' });
      return;
    }
    const password_hash = await bcrypt.hash(password, 10);
    // L'org principale de ce nouvel user sera son propre espace (créé plus tard si besoin)
    // Pour l'instant, on le rattache directement à l'org de l'invitation
    user = await prisma.userApp.create({
      data: {
        id: uuidv4(),
        organization_id: inv.organization_id,
        full_name,
        email,
        password_hash,
        role: inv.role,
      },
    });
  } else {
    // Utilisateur existant — vérifier qu'il n'est pas déjà dans cette org
    const existing = await prisma.userOrganization.findUnique({
      where: { user_id_organization_id: { user_id: user.id, organization_id: inv.organization_id } },
    });
    if (user.organization_id === inv.organization_id || existing) {
      res.status(409).json({ error: 'Vous faites déjà partie de cette organisation.' });
      return;
    }
    // Ajouter l'utilisateur existant à l'org via user_organizations
    await prisma.userOrganization.create({
      data: {
        id: uuidv4(),
        user_id: user.id,
        organization_id: inv.organization_id,
        role: inv.role,
      },
    });
  }

  // Marquer l'invitation comme acceptée
  await prisma.invitation.update({
    where: { token },
    data: { accepted_at: new Date(), accepted_by: user.id },
  });

  await createAuditEntry({
    organizationId: inv.organization_id,
    actor: email,
    action: 'invitation.accept',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.full_name,
    oldValue: {},
    newValue: { role: inv.role },
    ipAddress: req.ip ?? '',
    userAgent: req.headers['user-agent'] ?? '',
  });

  // Générer un token pour l'org de l'invitation
  const jwtToken = generateToken({
    userId: user.id,
    organizationId: inv.organization_id,
    email: user.email,
    role: inv.role,
  });

  const org = inv.organization;
  res.json({
    token: jwtToken,
    user: {
      id: user.id,
      organization_id: inv.organization_id,
      full_name: user.full_name,
      email: user.email,
      role: inv.role,
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

export default router;
