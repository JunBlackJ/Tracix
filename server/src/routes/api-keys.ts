import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditEntry, getClientIp } from '../middleware/audit';

// ─── Extend Express Request for API key auth ───
declare global {
  namespace Express {
    interface Request {
      apiKeyOrgId?: string;
    }
  }
}

// ─── API Keys router (requires session auth) ───
const router = Router();
router.use(requireAuth);

const ApiKeyCreateSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default(['read']),
  expires_at: z.string().nullable().optional(),
});

// GET /api/keys
router.get('/', requirePermission('api_keys.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const keys = await (prisma as any).apiKey.findMany({
    where: { organization_id: orgId, revoked: false },
    select: {
      id: true,
      name: true,
      key_prefix: true,
      scopes: true,
      last_used_at: true,
      expires_at: true,
      revoked: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });
  res.json(keys);
});

// POST /api/keys — creates and returns full key ONCE
router.post('/', requirePermission('api_keys.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = ApiKeyCreateSchema.parse(req.body);

  const rawKey = `trcx_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12);

  const apiKey = await (prisma as any).apiKey.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      name: body.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: body.scopes,
      expires_at: body.expires_at ? new Date(body.expires_at) : null,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'api_key.created',
    targetType: 'api_key',
    targetId: apiKey.id,
    targetLabel: body.name,
    oldValue: {},
    newValue: { name: body.name, scopes: body.scopes, key_prefix: keyPrefix },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  // Return full key only once
  res.status(201).json({ ...apiKey, key: rawKey });
});

// DELETE /api/keys/:id — revoke
router.delete('/:id', requirePermission('api_keys.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await (prisma as any).apiKey.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  await (prisma as any).apiKey.update({
    where: { id: req.params.id },
    data: { revoked: true },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'api_key.revoked',
    targetType: 'api_key',
    targetId: existing.id,
    targetLabel: existing.name,
    oldValue: { revoked: false },
    newValue: { revoked: true },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.status(204).send();
});

// ─── SCIM v2 router ───
export const scimRouter = Router();

// Middleware: requireApiKeyAuth
async function requireApiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }
  const token = authHeader.slice(7);
  const keyHash = crypto.createHash('sha256').update(token).digest('hex');

  const apiKey = await (prisma as any).apiKey.findFirst({
    where: {
      key_hash: keyHash,
      revoked: false,
    },
  });

  if (!apiKey) {
    res.status(401).json({ error: 'Invalid or revoked API key' });
    return;
  }

  // Check expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    res.status(401).json({ error: 'API key expired' });
    return;
  }

  // Check scim scope
  const scopes: string[] = apiKey.scopes as string[];
  if (!scopes.includes('scim') && !scopes.includes('write')) {
    res.status(403).json({ error: 'Insufficient scopes for SCIM' });
    return;
  }

  // Update last_used_at (fire-and-forget)
  (prisma as any).apiKey.update({
    where: { id: apiKey.id },
    data: { last_used_at: new Date() },
  }).catch(() => {});

  req.apiKeyOrgId = apiKey.organization_id;
  next();
}

scimRouter.use(requireApiKeyAuth);

function toScimUser(member: {
  id: string;
  username: string;
  full_name: string;
  email: string;
  status: string;
  created_at: Date | string;
  updated_at?: Date | string;
}) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: member.id,
    userName: member.username,
    name: { formatted: member.full_name },
    emails: [{ value: member.email, primary: true }],
    active: member.status !== 'inactif',
    meta: {
      resourceType: 'User',
      created: member.created_at,
      lastModified: member.updated_at ?? member.created_at,
    },
  };
}

// GET /api/scim/v2/ServiceProviderConfig
scimRouter.get('/v2/ServiceProviderConfig', (_req: Request, res: Response) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: '',
    patch: { supported: false },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: false, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard',
        specUri: 'http://www.rfc-editor.org/info/rfc6750',
        type: 'oauthbearertoken',
        primary: true,
      },
    ],
  });
});

// GET /api/scim/v2/Users
scimRouter.get('/v2/Users', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.apiKeyOrgId!;
  const members = await prisma.member.findMany({
    where: { organization_id: orgId },
    orderBy: { full_name: 'asc' },
  });

  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: members.length,
    startIndex: 1,
    itemsPerPage: members.length,
    Resources: members.map(toScimUser),
  });
});

// POST /api/scim/v2/Users
scimRouter.post('/v2/Users', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.apiKeyOrgId!;
  const body = req.body as {
    userName?: string;
    name?: { formatted?: string };
    emails?: Array<{ value: string; primary?: boolean }>;
  };

  const username = body.userName ?? '';
  const fullName = body.name?.formatted ?? username;
  const emailEntry = (body.emails ?? []).find((e) => e.primary) ?? body.emails?.[0];
  const email = emailEntry?.value ?? '';

  if (!email) {
    res.status(400).json({ detail: 'email is required', schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'] });
    return;
  }

  const member = await prisma.member.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      full_name: fullName,
      username: username || email.split('@')[0],
      email,
      account_type: 'nominatif',
      status: 'actif',
      risk_score: 50,
      risk_factors: [],
    },
  });

  res.status(201).json(toScimUser(member));
});

// GET /api/scim/v2/Users/:id
scimRouter.get('/v2/Users/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.apiKeyOrgId!;
  const member = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!member) {
    res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'User not found', status: 404 });
    return;
  }
  res.json(toScimUser(member));
});

// PUT /api/scim/v2/Users/:id
scimRouter.put('/v2/Users/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.apiKeyOrgId!;
  const existing = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'User not found', status: 404 });
    return;
  }

  const body = req.body as {
    userName?: string;
    name?: { formatted?: string };
    emails?: Array<{ value: string; primary?: boolean }>;
    active?: boolean;
  };

  const emailEntry = (body.emails ?? []).find((e) => e.primary) ?? body.emails?.[0];
  const updated = await prisma.member.update({
    where: { id: req.params.id },
    data: {
      full_name: body.name?.formatted ?? existing.full_name,
      username: body.userName ?? existing.username,
      email: emailEntry?.value ?? existing.email,
      status: body.active === false ? 'inactif' : 'actif',
    },
  });

  res.json(toScimUser(updated));
});

// DELETE /api/scim/v2/Users/:id — désactiver (status = inactif)
scimRouter.delete('/v2/Users/:id', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.apiKeyOrgId!;
  const existing = await prisma.member.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'User not found', status: 404 });
    return;
  }

  await prisma.member.update({
    where: { id: req.params.id },
    data: { status: 'inactif' },
  });

  res.status(204).send();
});

export default router;
