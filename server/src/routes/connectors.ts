import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';

const router = Router();
router.use(requireAuth);

const ConnectorSchema = z.object({
  provider: z.enum(['github', 'okta', 'microsoft_graph', 'google_workspace']),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

// ─── Sync helpers ───

async function syncGitHub(orgId: string, config: Record<string, unknown>): Promise<number> {
  const { token, org } = config as { token: string; org: string };
  const resp = await fetch(`https://api.github.com/orgs/${org}/members?per_page=100`, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'Tracix-Sync/1.0' },
  });
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  const members = (await resp.json()) as Array<{ login: string; email?: string | null }>;

  let count = 0;
  for (const m of members) {
    const email = (m.email && m.email.length > 0) ? m.email : `${m.login}@github.local`;
    await prisma.member.upsert({
      where: { organization_id_email: { organization_id: orgId, email } },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        full_name: m.login,
        username: m.login,
        email,
        team: 'GitHub',
        account_type: 'nominatif',
        status: 'actif',
        risk_score: 50,
        risk_factors: [],
      },
      update: { full_name: m.login, team: 'GitHub' },
    });
    count++;
  }
  return count;
}

async function syncOkta(orgId: string, config: Record<string, unknown>): Promise<number> {
  const { domain, token } = config as { domain: string; token: string };
  const resp = await fetch(
    `https://${domain}/api/v1/users?limit=200&filter=status+eq+%22ACTIVE%22`,
    { headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' } },
  );
  if (!resp.ok) throw new Error(`Okta API error: ${resp.status} ${resp.statusText}`);
  const users = (await resp.json()) as Array<{
    id: string;
    profile: { firstName: string; lastName: string; email: string };
    _links?: { groups?: { href: string } };
  }>;

  let count = 0;
  for (const u of users) {
    const fullName = `${u.profile.firstName} ${u.profile.lastName}`.trim();
    const email = u.profile.email;
    if (!email) continue;

    // Try to get groups for team name
    let team = 'Okta';
    try {
      const groupsResp = await fetch(
        `https://${domain}/api/v1/users/${u.id}/groups`,
        { headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' } },
      );
      if (groupsResp.ok) {
        const groups = (await groupsResp.json()) as Array<{ profile: { name: string } }>;
        if (groups.length > 0) team = groups[0].profile.name;
      }
    } catch (_) {
      // ignore group fetch error — keep default team
    }

    await prisma.member.upsert({
      where: { organization_id_email: { organization_id: orgId, email } },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        full_name: fullName,
        username: email.split('@')[0],
        email,
        team,
        account_type: 'nominatif',
        status: 'actif',
        risk_score: 50,
        risk_factors: [],
      },
      update: { full_name: fullName, team },
    });
    count++;
  }
  return count;
}

async function syncMicrosoftGraph(orgId: string, config: Record<string, unknown>): Promise<number> {
  const { tenant_id, client_id, client_secret } = config as {
    tenant_id: string;
    client_id: string;
    client_secret: string;
  };

  // Get OAuth2 token
  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id,
        client_secret,
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    },
  );
  if (!tokenResp.ok) throw new Error(`Microsoft token error: ${tokenResp.status}`);
  const tokenData = (await tokenResp.json()) as { access_token: string };

  const usersResp = await fetch(
    'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=200',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );
  if (!usersResp.ok) throw new Error(`Microsoft Graph error: ${usersResp.status}`);
  const usersData = (await usersResp.json()) as {
    value: Array<{ id: string; displayName: string; mail?: string | null; userPrincipalName: string }>;
  };

  let count = 0;
  for (const u of usersData.value) {
    const email = (u.mail && u.mail.length > 0) ? u.mail : u.userPrincipalName;
    if (!email) continue;
    const fullName = u.displayName;
    await prisma.member.upsert({
      where: { organization_id_email: { organization_id: orgId, email } },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        full_name: fullName,
        username: email.split('@')[0],
        email,
        team: 'Microsoft',
        account_type: 'nominatif',
        status: 'actif',
        risk_score: 50,
        risk_factors: [],
      },
      update: { full_name: fullName, team: 'Microsoft' },
    });
    count++;
  }
  return count;
}

async function syncGoogleWorkspace(orgId: string, config: Record<string, unknown>): Promise<number> {
  const { access_token, domain } = config as { access_token: string; domain: string };
  const resp = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users?domain=${domain}&maxResults=200`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (!resp.ok) throw new Error(`Google Workspace API error: ${resp.status}`);
  const data = (await resp.json()) as {
    users?: Array<{ primaryEmail: string; name: { fullName: string } }>;
  };

  let count = 0;
  for (const u of data.users ?? []) {
    const email = u.primaryEmail;
    if (!email) continue;
    const fullName = u.name.fullName;
    await prisma.member.upsert({
      where: { organization_id_email: { organization_id: orgId, email } },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        full_name: fullName,
        username: email.split('@')[0],
        email,
        team: 'Google Workspace',
        account_type: 'nominatif',
        status: 'actif',
        risk_score: 50,
        risk_factors: [],
      },
      update: { full_name: fullName, team: 'Google Workspace' },
    });
    count++;
  }
  return count;
}

async function runSync(connectorId: string, orgId: string, provider: string, config: Record<string, unknown>): Promise<void> {
  try {
    let count = 0;
    if (provider === 'github') count = await syncGitHub(orgId, config);
    else if (provider === 'okta') count = await syncOkta(orgId, config);
    else if (provider === 'microsoft_graph') count = await syncMicrosoftGraph(orgId, config);
    else if (provider === 'google_workspace') count = await syncGoogleWorkspace(orgId, config);

    await (prisma as any).connector.update({
      where: { id: connectorId },
      data: {
        last_sync_at: new Date(),
        last_sync_status: 'success',
        last_sync_error: '',
        synced_count: count,
      },
    });

    await createAuditEntry({
      organizationId: orgId,
      actor: 'system',
      action: 'connector.synced',
      targetType: 'connector',
      targetId: connectorId,
      targetLabel: provider,
      oldValue: {},
      newValue: { synced_count: count },
      ipAddress: '',
      userAgent: '',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await (prisma as any).connector.update({
      where: { id: connectorId },
      data: {
        last_sync_at: new Date(),
        last_sync_status: 'error',
        last_sync_error: message,
      },
    });
  }
}

// GET /api/connectors
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const connectors = await (prisma as any).connector.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: 'asc' },
  });
  res.json(connectors);
});

// POST /api/connectors — upsert on organization_id + provider
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = ConnectorSchema.parse(req.body);

  const connector = await (prisma as any).connector.upsert({
    where: {
      organization_id_provider: { organization_id: orgId, provider: body.provider },
    },
    create: {
      id: uuidv4(),
      organization_id: orgId,
      provider: body.provider,
      config: body.config,
      enabled: body.enabled,
    },
    update: {
      config: body.config,
      enabled: body.enabled,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'connector.upserted',
    targetType: 'connector',
    targetId: connector.id,
    targetLabel: body.provider,
    oldValue: {},
    newValue: { provider: body.provider, enabled: body.enabled },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(201).json(connector);
});

// DELETE /api/connectors/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await (prisma as any).connector.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Connector not found' });
    return;
  }

  await (prisma as any).connector.delete({ where: { id: req.params.id } });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'connector.deleted',
    targetType: 'connector',
    targetId: existing.id,
    targetLabel: existing.provider,
    oldValue: existing as Record<string, unknown>,
    newValue: {},
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

// POST /api/connectors/:id/sync — fire-and-forget
router.post('/:id/sync', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const connector = await (prisma as any).connector.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!connector) {
    res.status(404).json({ error: 'Connector not found' });
    return;
  }

  // Fire-and-forget
  runSync(connector.id, orgId, connector.provider, connector.config as Record<string, unknown>).catch((err) =>
    console.error('[Connector] Sync error:', err),
  );

  res.status(202).json({ message: 'Sync started', connector_id: connector.id });
});

export default router;
