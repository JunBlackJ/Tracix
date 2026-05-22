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
  headers: z.array(z.string()).min(1).max(100),
  sampleRows: z.array(z.array(z.string())).max(10),
});

router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const awsRegion = process.env.AWS_REGION;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
    res.status(503).json({ error: 'AWS credentials not configured (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)' });
    return;
  }

  const { headers, sampleRows } = AnalyzeSchema.parse(req.body);

  const headerList = headers.map((h: string, i: number) => `  [${i}] "${h}"`).join('\n');
  const sampleTable = sampleRows.slice(0, 5).map((row: string[]) =>
    '  | ' + headers.map((_: string, i: number) => String(row[i] ?? '').substring(0, 30)).join(' | ') + ' |'
  ).join('\n');

  const prompt = `You are analyzing an Excel file for an IT access management application. The file tracks which employees have access to which platforms/tools.

Headers (with their column index):
${headerList}

Sample data rows:
${sampleTable}

Identify:
1. memberCol: index of the column containing the person's full name (could be "Nom", "Name", "Collaborateur", "Prénom Nom", etc.)
2. teamCol: index of the team/department column (could be "Équipe", "Service", "Department", "Pôle", etc.) — null if absent
3. emailCol: index of the email column — null if absent
4. platformCols: indexes of ALL remaining columns that represent platforms/tools/applications (GitHub, Jira, Notion, AWS, etc.)
5. levelMappings: for any non-standard access level values found in the sample data, map them to one of: "admin", "rw" (read-write/editor), "ro" (read-only/viewer), "req" (requested), "none" (no access / empty)
   Common patterns: "X", "✓", "Oui", "Yes", "1", "true" → typically "rw" or check context; "A" or "Admin" → "admin"; blank/"-"/"Non"/"No"/"0" → "none"
6. confidence: your confidence level ("high", "medium", or "low")
7. notes: a short explanation in French about what you detected, or any ambiguity

Respond with ONLY valid JSON matching this TypeScript interface, no markdown, no explanation:
{
  "memberCol": number | null,
  "teamCol": number | null,
  "emailCol": number | null,
  "platformCols": number[],
  "levelMappings": Record<string, "admin" | "rw" | "ro" | "req" | "none">,
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
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (message.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '{}';

  let analysis: unknown;
  try {
    analysis = JSON.parse(text.trim());
  } catch {
    res.status(500).json({ error: 'Invalid AI response', raw: text });
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

export default router;
