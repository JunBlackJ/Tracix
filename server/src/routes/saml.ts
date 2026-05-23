import { Router, Request, Response } from 'express';
import { SAML } from '@node-saml/node-saml';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { generateToken, requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { config } from '../config';

const router = Router();

// Build a SAML instance from the org's stored config
async function getSamlInstance(orgId: string): Promise<SAML | null> {
  const cfg = await prisma.samlConfig.findUnique({ where: { organization_id: orgId } });
  if (!cfg || !cfg.is_enabled) return null;

  return new SAML({
    callbackUrl: `${config.apiUrl}/api/saml/${orgId}/callback`,
    entryPoint: cfg.sso_url,
    issuer: cfg.entity_id,
    idpCert: cfg.certificate,
    wantAssertionsSigned: true,
    acceptedClockSkewMs: 5000,
  });
}

// ─── GET /api/saml/:orgId/metadata ───
router.get('/:orgId/metadata', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const cfg = await prisma.samlConfig.findUnique({ where: { organization_id: orgId } });
  if (!cfg || !cfg.is_enabled) {
    res.status(404).json({ error: 'SSO non configuré pour cette organisation' });
    return;
  }

  const saml = await getSamlInstance(orgId);
  if (!saml) { res.status(404).json({ error: 'SSO non configuré' }); return; }

  const metadata = saml.generateServiceProviderMetadata(null, cfg.certificate);
  res.type('application/xml').send(metadata);
});

// ─── GET /api/saml/:orgId/login  — initiate SAML flow ───
router.get('/:orgId/login', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const saml = await getSamlInstance(orgId);
  if (!saml) {
    res.redirect(`${config.frontendUrl}/oauth/callback?error=${encodeURIComponent('SSO non configuré pour cette organisation')}`);
    return;
  }

  const url = await saml.getAuthorizeUrlAsync('', undefined, {});
  res.redirect(url);
});

// ─── POST /api/saml/:orgId/callback  — IdP posts here ───
router.post('/:orgId/callback', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const saml = await getSamlInstance(orgId);
  if (!saml) {
    res.redirect(`${config.frontendUrl}/oauth/callback?error=${encodeURIComponent('SSO non configuré')}`);
    return;
  }

  try {
    const { profile } = await saml.validatePostResponseAsync(req.body);
    if (!profile) throw new Error('Profil SAML vide');

    const email = (profile.email ?? profile.nameID ?? '') as string;
    const fullName = ((profile.displayName ?? profile['http://schemas.microsoft.com/identity/claims/displayname'] ?? profile.nameID) as string | undefined) ?? email.split('@')[0];

    if (!email) throw new Error('Email introuvable dans la réponse SAML');

    let user = await prisma.userApp.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      // First SSO login — attach to the org that owns this SAML config
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) throw new Error('Organisation introuvable');

      const userId = uuidv4();
      user = await prisma.userApp.create({
        data: {
          id: userId,
          organization_id: orgId,
          full_name: fullName,
          email,
          oauth_provider: 'saml',
          oauth_id: profile.nameID as string,
          role: 'viewer',
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
        newValue: { provider: 'saml' },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? '',
      });
    } else {
      await prisma.userApp.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
      await createAuditEntry({
        organizationId: user.organization_id,
        actor: email,
        action: 'auth.login',
        targetType: 'user',
        targetId: user.id,
        targetLabel: user.full_name,
        oldValue: {},
        newValue: { provider: 'saml', last_login_at: new Date().toISOString() },
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

    res.redirect(`${config.frontendUrl}/oauth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SAML error';
    console.error('[SAML] Callback error:', msg);
    res.redirect(`${config.frontendUrl}/oauth/callback?error=${encodeURIComponent(msg)}`);
  }
});

// ─── GET /api/saml/config  — get org's SAML config (auth required) ───
router.get('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const cfg = await prisma.samlConfig.findUnique({ where: { organization_id: orgId } });
  if (!cfg) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    id: cfg.id,
    entity_id: cfg.entity_id,
    sso_url: cfg.sso_url,
    certificate: cfg.certificate,
    is_enabled: cfg.is_enabled,
    metadata_url: `${config.apiUrl}/api/saml/${orgId}/metadata`,
    login_url: `${config.apiUrl}/api/saml/${orgId}/login`,
  });
});

// ─── POST /api/saml/config  — save SAML config ───
router.post('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { entity_id, sso_url, certificate, is_enabled } = req.body;

  if (!entity_id || !sso_url || !certificate) {
    res.status(400).json({ error: 'entity_id, sso_url et certificate sont requis' });
    return;
  }

  // Normalize certificate (strip headers if present, keep raw base64)
  const cleanCert = (certificate as string)
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  const existing = await prisma.samlConfig.findUnique({ where: { organization_id: orgId } });

  const cfg = existing
    ? await prisma.samlConfig.update({
        where: { organization_id: orgId },
        data: { entity_id, sso_url, certificate: cleanCert, is_enabled: !!is_enabled },
      })
    : await prisma.samlConfig.create({
        data: { id: uuidv4(), organization_id: orgId, entity_id, sso_url, certificate: cleanCert, is_enabled: !!is_enabled },
      });

  res.json({
    configured: true,
    id: cfg.id,
    entity_id: cfg.entity_id,
    sso_url: cfg.sso_url,
    certificate: cfg.certificate,
    is_enabled: cfg.is_enabled,
    metadata_url: `${config.apiUrl}/api/saml/${orgId}/metadata`,
    login_url: `${config.apiUrl}/api/saml/${orgId}/login`,
  });
});

// ─── DELETE /api/saml/config  — delete SAML config ───
router.delete('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  await prisma.samlConfig.deleteMany({ where: { organization_id: orgId } });
  res.json({ success: true });
});

export default router;
