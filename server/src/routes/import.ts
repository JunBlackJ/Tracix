import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { getLimits } from '../services/plan.service';
import { recomputeAllRiskScores } from '../services/risk.service';
import { generateAlerts } from '../services/alert.service';
import { classifyAndCategorizePlatforms, ensureExcelCategories } from '../services/platform-category.service';

const router = Router();
router.use(requireAuth);

// ─── POST /api/import/analyze — AI column detection ───
const AnalyzeSchema = z.object({
  // All raw rows from the sheet (up to 50), including title/legend rows
  rawRows: z.array(z.array(z.string())).min(1).max(50),
});

router.post('/analyze', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const awsRegion = process.env.AWS_REGION;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
    res.status(503).json({ error: 'AWS credentials not configured (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)' });
    return;
  }

  const { rawRows } = AnalyzeSchema.parse(req.body);

  // Render all rows with their index so Claude can identify the header row
  const rowDump = rawRows.map((row: string[], i: number) => {
    const cells = row.map((c: string) => `"${String(c).substring(0, 40).replace(/"/g, "'")}"`)
      .join(', ');
    return `  Ligne ${i}: [${cells}]`;
  }).join('\n');

  const prompt = `Tu analyses un fichier Excel pour une application de gestion IT. Identifie le TYPE puis extrais les informations adaptées.

Voici TOUTES les lignes brutes du fichier avec leur index :
${rowDump}

ÉTAPE 1 — Type du fichier (choisis UN seul) :
- "access_matrix" : matrice d'habilitations classique (lignes=personnes, colonnes=plateformes avec niveaux d'accès)
- "access_matrix_transposed" : matrice inversée (lignes=plateformes, colonnes=personnes avec niveaux d'accès)
- "platform_inventory" : inventaire de plateformes/outils (lignes=plateformes, colonnes=caractéristiques)
- "subscription_inventory" : inventaire d'abonnements/licences (lignes=abonnements, colonnes=nom, fournisseur, coût, renouvellement, etc.)
- "system_inventory" : inventaire de serveurs/systèmes (hostname, IP, OS, criticité, responsable, etc.)
- "network_flow_inventory" : inventaire de flux réseau (source, destination, port, protocole, statut, etc.)
- "member_list" : liste de membres/employés uniquement
- "unknown" : structure non reconnue

ÉTAPE 2 — Champs COMMUNS à tous les types :
- headerRowIndex : index (0-based) de la vraie ligne d'en-têtes — ignorer les titres de section au-dessus
- subHeaderRowIndex : si les en-têtes sont sur 2 lignes (ex: ligne 3=groupe "GitHub", ligne 4="Admin/RW/RO"), donne l'index de la 2e ligne. null sinon
- dataEndRow : index exclusif de fin des données réelles (null=jusqu'à la fin)
- warnings : tableau de strings — signaler doublons de noms, lignes vides au milieu, sous-totaux, valeurs suspectes
- confidence : "high" | "medium" | "low"
- notes : explication courte en français

ÉTAPE 3 — Champs SPÉCIFIQUES selon le type :

"access_matrix" :
- memberCol : colonne nom complet — null si prénom/nom séparés
- firstNameCol : colonne prénom — null si nom complet dans memberCol
- lastNameCol : colonne nom de famille — null si nom complet dans memberCol
- teamCol, emailCol
- platformCols : TOUTES les colonnes plateforme sans exception
- levelMappings : "admin"|"rw"|"ro"|"req"|"none" pour chaque valeur trouvée

"access_matrix_transposed" :
- memberRow : index de la ligne contenant les noms des personnes (souvent = headerRowIndex)
- platformCol : index de la colonne contenant les noms des plateformes
- levelMappings

"platform_inventory" :
- nameCol (obligatoire), categoryCol, urlCol, statusCol

"subscription_inventory" :
- nameCol (obligatoire), categoryCol, vendorCol, renewalCol, statusCol
- costMonthlyCol : colonne coût mensuel — null si absent
- costAnnualCol : colonne coût annuel — null si absent
- currencyCol : colonne devise — null si absent

"system_inventory" :
- nameCol : hostname/nom système (obligatoire)
- ipCol : adresse IP — null si absent
- osCol : système d'exploitation — null si absent
- typeCol : type (serveur, VM, etc.) — null si absent
- criticalityCol : criticité — null si absent
- statusCol, responsibleCol

"network_flow_inventory" :
- sourceCol : source (obligatoire), destinationCol (obligatoire)
- portCol, protocolCol, statusCol, directionCol

"member_list" :
- memberCol : nom complet — null si prénom/nom séparés
- firstNameCol, lastNameCol, teamCol, emailCol

Réponds UNIQUEMENT avec du JSON valide, sans markdown. Tous les champs non applicables au type détecté valent null ou [] :
{
  "fileType": string,
  "headerRowIndex": number,
  "subHeaderRowIndex": number | null,
  "dataEndRow": number | null,
  "warnings": string[],
  "memberCol": number | null,
  "firstNameCol": number | null,
  "lastNameCol": number | null,
  "teamCol": number | null,
  "emailCol": number | null,
  "platformCols": number[],
  "levelMappings": {},
  "memberRow": number | null,
  "platformCol": number | null,
  "nameCol": number | null,
  "categoryCol": number | null,
  "urlCol": number | null,
  "vendorCol": number | null,
  "renewalCol": number | null,
  "statusCol": number | null,
  "costMonthlyCol": number | null,
  "costAnnualCol": number | null,
  "currencyCol": number | null,
  "ipCol": number | null,
  "osCol": number | null,
  "typeCol": number | null,
  "criticalityCol": number | null,
  "responsibleCol": number | null,
  "sourceCol": number | null,
  "destinationCol": number | null,
  "portCol": number | null,
  "protocolCol": number | null,
  "directionCol": number | null,
  "confidence": "high" | "medium" | "low",
  "notes": string
}`;

  const client = new AnthropicBedrock({
    awsRegion,
    awsAccessKey: awsAccessKeyId,
    awsSecretKey: awsSecretAccessKey,
  });
  const message = await client.messages.create({
    model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '{}';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let analysis: unknown;
  try {
    analysis = JSON.parse(text);
  } catch {
    res.status(500).json({ error: 'Invalid AI response', raw });
    return;
  }

  res.json(analysis);
});

const BatchSchema = z.object({
  members: z.array(z.object({
    full_name: z.string().default(''),
    email: z.string().optional().default(''),
    team: z.string().optional().default(''),
  })).max(500),
  platforms: z.array(z.object({
    name: z.string().default(''),
  })).max(100),
  access: z.array(z.object({
    memberName: z.string(),
    platformName: z.string(),
    level: z.enum(['admin', 'rw', 'ro', 'req']),
  })).max(10000),
});

// POST /api/import/batch — import members + platforms + access rights in one transaction
router.post('/batch', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { members: inMembers, platforms: inPlatforms, access: inAccess } = BatchSchema.parse(req.body);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  const today = new Date().toISOString().split('T')[0];

  // Load existing data to deduplicate
  const [existingMembers, existingPlatforms, existingAccess] = await Promise.all([
    prisma.member.findMany({
      where: { organization_id: orgId },
      select: { id: true, full_name: true, email: true, username: true },
    }),
    prisma.platform.findMany({
      where: { organization_id: orgId },
      select: { id: true, name: true },
    }),
    prisma.accessRight.findMany({
      where: { organization_id: orgId },
      select: { member_id: true, platform_id: true },
    }),
  ]);

  const memberByName = new Map(existingMembers.map((m) => [m.full_name.toLowerCase(), m.id]));
  const memberByEmail = new Map(existingMembers.map((m) => [m.email.toLowerCase(), m.id]));
  const usedUsernames = new Set(existingMembers.map((m) => m.username.toLowerCase()));
  const platformByName = new Map(existingPlatforms.map((p) => [p.name.toLowerCase(), p.id]));
  const accessSet = new Set(existingAccess.map((a) => `${a.member_id}:${a.platform_id}`));

  // Deduplicate incoming data
  const seenMemberNames = new Set<string>();
  const uniqueInMembers = inMembers.filter((m) => {
    const key = m.full_name.toLowerCase();
    if (seenMemberNames.has(key)) return false;
    seenMemberNames.add(key);
    return true;
  });

  const toCreateMembers = uniqueInMembers.filter((m) => {
    if (memberByName.has(m.full_name.toLowerCase())) return false;
    const email = m.email.trim();
    if (email && memberByEmail.has(email.toLowerCase())) return false;
    return true;
  });

  const seenPlatformNames = new Set<string>();
  const uniqueInPlatforms = inPlatforms.filter((p) => {
    const key = p.name.toLowerCase();
    if (seenPlatformNames.has(key)) return false;
    seenPlatformNames.add(key);
    return true;
  });
  const toCreatePlatforms = uniqueInPlatforms.filter((p) => !platformByName.has(p.name.toLowerCase()));

  // Apply plan limits — truncate to available slots
  const memberSlots = limits.members === -1 ? toCreateMembers.length : Math.max(0, limits.members - existingMembers.length);
  const platformSlots = limits.platforms === -1 ? toCreatePlatforms.length : Math.max(0, limits.platforms - existingPlatforms.length);
  const skippedMembers = Math.max(0, toCreateMembers.length - memberSlots);
  const skippedPlatforms = Math.max(0, toCreatePlatforms.length - platformSlots);

  const membersToCreate = toCreateMembers.slice(0, memberSlots);
  const platformsToCreate = toCreatePlatforms.slice(0, platformSlots);

  const makeUsername = (fullName: string): string => {
    const base = fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'user';
    let username = base;
    let i = 2;
    while (usedUsernames.has(username)) username = `${base}.${i++}`;
    usedUsernames.add(username);
    return username;
  };

  const { membersCreated, platformsCreated, accessCreated } = await prisma.$transaction(async (tx) => {
    let membersCreated = 0;
    for (const m of membersToCreate) {
      const id = uuidv4();
      const username = makeUsername(m.full_name);
      const email = m.email.trim() || `${username}@import.local`;
      if (memberByEmail.has(email.toLowerCase())) continue;
      await tx.member.create({
        data: {
          id,
          organization_id: orgId,
          full_name: m.full_name,
          username,
          email,
          team: m.team.trim() || 'Non défini',
          account_type: 'nominatif',
          status: 'actif',
          risk_score: 50,
          risk_factors: [],
        },
      });
      memberByName.set(m.full_name.toLowerCase(), id);
      memberByEmail.set(email.toLowerCase(), id);
      membersCreated++;
    }

    let platformsCreated = 0;
    for (const p of platformsToCreate) {
      const id = uuidv4();
      await tx.platform.create({
        data: { id, organization_id: orgId, name: p.name, status: 'actif' },
      });
      platformByName.set(p.name.toLowerCase(), id);
      platformsCreated++;
    }

    let accessCreated = 0;
    for (const a of inAccess) {
      const memberId = memberByName.get(a.memberName.toLowerCase());
      const platformId = platformByName.get(a.platformName.toLowerCase());
      if (!memberId || !platformId) continue;
      const key = `${memberId}:${platformId}`;
      if (accessSet.has(key)) continue;
      await tx.accessRight.create({
        data: {
          id: uuidv4(),
          organization_id: orgId,
          member_id: memberId,
          platform_id: platformId,
          level: a.level,
          granted_by: 'Import Excel',
          granted_at: today,
          last_review_date: today,
        },
      });
      accessSet.add(key);
      accessCreated++;
    }

    return { membersCreated, platformsCreated, accessCreated };
  });

  // Recompute risk scores, generate alerts, and classify platform categories asynchronously
  recomputeAllRiskScores(orgId).catch(() => {});
  generateAlerts(orgId).catch(() => {});
  if (platformsCreated > 0) classifyAndCategorizePlatforms(orgId).catch(() => {});

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'import.excel',
    targetType: 'import',
    targetId: orgId,
    targetLabel: 'Import Excel',
    oldValue: {},
    newValue: { membersCreated, platformsCreated, accessCreated },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({
    created: { members: membersCreated, platforms: platformsCreated, accessRights: accessCreated },
    skipped: { members: skippedMembers, platforms: skippedPlatforms },
  });
});

// POST /api/import/batch-platforms — import platforms only
const BatchPlatformsSchema = z.object({
  platforms: z.array(z.object({
    name: z.string(),
    category: z.string().optional().default(''),
    url: z.string().optional().default(''),
    status: z.string().optional().default('actif'),
  })).max(500),
});

router.post('/batch-platforms', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { platforms: inPlatforms } = BatchPlatformsSchema.parse(req.body);

  const existing = await prisma.platform.findMany({
    where: { organization_id: orgId },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  const slots = limits.platforms === -1 ? inPlatforms.length : Math.max(0, limits.platforms - existing.length);

  const toCreate = inPlatforms.filter((p) => !byName.has(p.name.toLowerCase())).slice(0, slots);
  const skipped = inPlatforms.filter((p) => !byName.has(p.name.toLowerCase())).length - toCreate.length;

  let created = 0;
  for (const p of toCreate) {
    await prisma.platform.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        name: p.name,
        category: p.category,
        url: p.url,
        status: p.status || 'actif',
      },
    });
    created++;
  }

  if (created > 0) {
    ensureExcelCategories(orgId).catch(() => {});
    classifyAndCategorizePlatforms(orgId).catch(() => {});
  }

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'import.platforms',
    targetType: 'import',
    targetId: orgId,
    targetLabel: 'Import plateformes',
    oldValue: {},
    newValue: { created },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ created, skipped });
});

// POST /api/import/batch-subscriptions — import subscriptions only
const BatchSubscriptionsSchema = z.object({
  subscriptions: z.array(z.object({
    name: z.string(),
    vendor: z.string().optional().default(''),
    category: z.string().optional().default(''),
    renewal_date: z.string().optional().default(''),
    status: z.string().optional().default('actif'),
  })).max(500),
});

router.post('/batch-subscriptions', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { subscriptions: inSubs } = BatchSubscriptionsSchema.parse(req.body);

  const existing = await prisma.subscription.findMany({
    where: { organization_id: orgId },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s.id]));

  const toCreate = inSubs.filter((s) => !byName.has(s.name.toLowerCase()));
  const skipped = inSubs.length - toCreate.length;

  let created = 0;
  for (const s of toCreate) {
    await prisma.subscription.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        name: s.name,
        vendor: s.vendor,
        category: s.category,
        renewal_date: s.renewal_date,
        status: s.status || 'actif',
      },
    });
    created++;
  }

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'import.subscriptions',
    targetType: 'import',
    targetId: orgId,
    targetLabel: 'Import abonnements',
    oldValue: {},
    newValue: { created },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ created, skipped });
});

// POST /api/import/batch-members — import members only
const BatchMembersSchema = z.object({
  members: z.array(z.object({
    full_name: z.string(),
    email: z.string().optional().default(''),
    team: z.string().optional().default(''),
  })).max(500),
});

router.post('/batch-members', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { members: inMembers } = BatchMembersSchema.parse(req.body);

  const existing = await prisma.member.findMany({
    where: { organization_id: orgId },
    select: { id: true, full_name: true, email: true, username: true },
  });
  const byName = new Map(existing.map((m) => [m.full_name.toLowerCase(), m.id]));
  const byEmail = new Map(existing.map((m) => [m.email.toLowerCase(), m.id]));
  const usedUsernames = new Set(existing.map((m) => m.username.toLowerCase()));

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const limits = getLimits(org?.plan ?? 'free');
  const slots = limits.members === -1 ? inMembers.length : Math.max(0, limits.members - existing.length);

  const toCreate = inMembers.filter((m) => {
    if (byName.has(m.full_name.toLowerCase())) return false;
    if (m.email && byEmail.has(m.email.toLowerCase())) return false;
    return true;
  }).slice(0, slots);
  const skipped = inMembers.filter((m) => !byName.has(m.full_name.toLowerCase())).length - toCreate.length;

  const makeUsername = (fullName: string): string => {
    const base = fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'user';
    let username = base;
    let i = 2;
    while (usedUsernames.has(username)) username = `${base}.${i++}`;
    usedUsernames.add(username);
    return username;
  };

  let created = 0;
  for (const m of toCreate) {
    const username = makeUsername(m.full_name);
    const email = m.email.trim() || `${username}@import.local`;
    if (byEmail.has(email.toLowerCase())) continue;
    await prisma.member.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        full_name: m.full_name,
        username,
        email,
        team: m.team.trim() || 'Non défini',
        account_type: 'nominatif',
        status: 'actif',
        risk_score: 50,
        risk_factors: [],
      },
    });
    byName.set(m.full_name.toLowerCase(), uuidv4());
    created++;
  }

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'import.members',
    targetType: 'import',
    targetId: orgId,
    targetLabel: 'Import membres',
    oldValue: {},
    newValue: { created },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ created, skipped });
});

// POST /api/import/batch-systems
const BatchSystemsSchema = z.object({
  systems: z.array(z.object({
    name: z.string(),
    ip_address: z.string().optional().default(''),
    os_version: z.string().optional().default(''),
    type: z.string().optional().default(''),
    criticality: z.string().optional().default('normale'),
    status: z.string().optional().default('actif'),
    responsible: z.string().optional().default(''),
  })).max(500),
});

router.post('/batch-systems', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { systems: inSystems } = BatchSystemsSchema.parse(req.body);

  const existing = await prisma.system.findMany({ where: { organization_id: orgId }, select: { hostname: true } });
  const existingNames = new Set(existing.map((s) => s.hostname.toLowerCase()));

  let created = 0;
  let skipped = 0;
  let sysCounter = existing.length + 1;
  for (const s of inSystems) {
    if (existingNames.has(s.name.toLowerCase())) { skipped++; continue; }
    await prisma.system.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        system_id: `SYS-${String(sysCounter++).padStart(3, '0')}`,
        hostname: s.name,
        ip_address: s.ip_address,
        os_version: s.os_version,
        type: s.type,
        criticality: s.criticality || 'normale',
        status: s.status || 'actif',
        tech_responsible: s.responsible,
      },
    });
    existingNames.add(s.name.toLowerCase());
    created++;
  }

  await createAuditEntry({ organizationId: orgId, actor: req.user!.email, action: 'import.systems', targetType: 'import', targetId: orgId, targetLabel: 'Import systèmes', oldValue: {}, newValue: { created }, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' });
  res.json({ created, skipped });
});

// POST /api/import/batch-network-flows
const BatchNetworkFlowsSchema = z.object({
  flows: z.array(z.object({
    source: z.string(),
    destination: z.string(),
    port: z.string().optional().default(''),
    protocol: z.string().optional().default(''),
    status: z.string().optional().default('autorisé'),
    direction: z.string().optional().default('entrant'),
  })).max(500),
});

router.post('/batch-network-flows', requirePermission('import.write'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { flows: inFlows } = BatchNetworkFlowsSchema.parse(req.body);

  const existing = await prisma.networkFlow.findMany({ where: { organization_id: orgId }, select: { flow_id: true } });
  let flowCounter = existing.length + 1;

  let created = 0;
  for (const f of inFlows) {
    await prisma.networkFlow.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        flow_id: `FLOW-${String(flowCounter++).padStart(3, '0')}`,
        source_host: f.source,
        destination_host: f.destination,
        port: f.port,
        protocol: f.protocol,
        status: f.status || 'autorisé',
        direction: f.direction || 'entrant',
      },
    });
    created++;
  }

  await createAuditEntry({ organizationId: orgId, actor: req.user!.email, action: 'import.network-flows', targetType: 'import', targetId: orgId, targetLabel: 'Import flux réseau', oldValue: {}, newValue: { created }, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' });
  res.json({ created, skipped: 0 });
});

export default router;
