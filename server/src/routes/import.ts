import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { getLimits } from '../services/plan.service';
import { recomputeAllRiskScores } from '../services/risk.service';

const router = Router();
router.use(requireAuth);

// ─── POST /api/import/analyze — AI column detection ───
const AnalyzeSchema = z.object({
  // All raw rows from the sheet (up to 50), including title/legend rows
  rawRows: z.array(z.array(z.string())).min(1).max(50),
});

router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
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

  const prompt = `Tu analyses un fichier Excel pour une application de gestion IT. Identifie d'abord le TYPE du fichier, puis extrais les informations adaptées.

Voici TOUTES les lignes brutes du fichier avec leur index :
${rowDump}

ÉTAPE 1 — Détermine le type du fichier :
- "access_matrix" : matrice d'habilitations (lignes = personnes, colonnes = plateformes avec niveaux d'accès)
- "platform_inventory" : inventaire de plateformes/outils (lignes = plateformes, colonnes = caractéristiques : nom, catégorie, URL, statut, responsable, etc.)
- "member_list" : liste de membres/employés sans colonnes de plateformes
- "unknown" : structure non reconnue

ÉTAPE 2 — Selon le type, remplis les champs correspondants :

Pour TOUS les types :
1. headerRowIndex : index (0-based) de la vraie ligne d'en-têtes (ignorer titres de section)
2. dataEndRow : index exclusif de fin des données réelles (null si jusqu'à la fin)
3. confidence : "high", "medium" ou "low"
4. notes : explication courte en français

Pour "access_matrix" uniquement :
5. memberCol : index colonne nom complet de la personne
6. teamCol : index colonne équipe — null si absente
7. emailCol : index colonne email — null si absente
8. platformCols : index de TOUTES les colonnes plateforme (GitHub, Jira, AWS, etc.) — LISTE ABSOLUMENT TOUTES, sans exception
9. levelMappings : mappe chaque valeur d'accès vers "admin"/"rw"/"ro"/"req"/"none"

Pour "platform_inventory" uniquement :
5. nameCol : index colonne nom de la plateforme (obligatoire)
6. categoryCol : index colonne catégorie/type — null si absent
7. urlCol : index colonne URL — null si absent
8. statusCol : index colonne statut/état — null si absent

Pour "member_list" uniquement :
5. memberCol : index colonne nom complet
6. teamCol : index colonne équipe — null si absent
7. emailCol : index colonne email — null si absent

Réponds UNIQUEMENT avec du JSON valide, sans markdown :
{
  "fileType": "access_matrix" | "platform_inventory" | "member_list" | "unknown",
  "headerRowIndex": number,
  "dataEndRow": number | null,
  "memberCol": number | null,
  "teamCol": number | null,
  "emailCol": number | null,
  "platformCols": number[],
  "levelMappings": Record<string, "admin" | "rw" | "ro" | "req" | "none">,
  "nameCol": number | null,
  "categoryCol": number | null,
  "urlCol": number | null,
  "statusCol": number | null,
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
    max_tokens: 2048,
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
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
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
    const email = m.email.trim();
    if (memberByName.has(m.full_name.toLowerCase())) return false;
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
      const email = m.email.trim() || `${makeUsername(m.full_name)}@import.local`;
      const username = makeUsername(m.full_name);
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

  // Recompute risk scores asynchronously
  recomputeAllRiskScores(orgId).catch(() => {});

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

router.post('/batch-platforms', async (req: Request, res: Response): Promise<void> => {
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

// POST /api/import/batch-members — import members only
const BatchMembersSchema = z.object({
  members: z.array(z.object({
    full_name: z.string(),
    email: z.string().optional().default(''),
    team: z.string().optional().default(''),
  })).max(500),
});

router.post('/batch-members', async (req: Request, res: Response): Promise<void> => {
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

export default router;
