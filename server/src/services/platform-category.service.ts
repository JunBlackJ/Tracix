import { v4 as uuidv4 } from 'uuid';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import prisma from '../prisma/client';

const MIN_PLATFORMS_PER_CATEGORY = 2;

const CATEGORY_COLORS: Record<string, string> = {
  'Cloud':          '#3B82F6',
  'DevOps':         '#8B5CF6',
  'Communication':  '#10B981',
  'Productivité':   '#F59E0B',
  'Sécurité':       '#EF4444',
  'Monitoring':     '#06B6D4',
  'Finance':        '#84CC16',
  'RH':             '#EC4899',
  'CRM':            '#F97316',
  'Développement':  '#6366F1',
  'Infrastructure': '#64748B',
  'Identité':       '#A855F7',
  'Collaboration':  '#0EA5E9',
  'Données':        '#14B8A6',
  'Support':        '#FB923C',
  'Autres':         '#6B7280',
};

function categoryColor(label: string): string {
  return CATEGORY_COLORS[label] ?? '#6B7280';
}

export async function classifyAndCategorizePlatforms(orgId: string): Promise<void> {
  const awsRegion = process.env.AWS_REGION;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return;

  // Only process platforms that have no category yet
  const platforms = await prisma.platform.findMany({
    where: { organization_id: orgId, category: '' },
    select: { id: true, name: true },
  });
  if (platforms.length === 0) return;

  const client = new AnthropicBedrock({
    awsRegion,
    awsAccessKey: awsAccessKeyId,
    awsSecretKey: awsSecretAccessKey,
  });

  const nameList = platforms.map((p) => `- ${p.name}`).join('\n');
  const prompt = `Tu es un expert IT. Classe chacun des outils/plateformes suivants dans une catégorie fonctionnelle en français.

Outils à classifier :
${nameList}

Règles :
- Utilise UNIQUEMENT ces catégories : Cloud, DevOps, Communication, Productivité, Sécurité, Monitoring, Finance, RH, CRM, Développement, Infrastructure, Identité, Collaboration, Données, Support
- Une seule catégorie par outil, basée sur sa fonction principale
- Si l'outil est inconnu ou ambigu, assigne "Autres"

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown :
{ "NomOutil": "Catégorie", ... }`;

  let aiResult: Record<string, string> = {};
  try {
    const message = await client.messages.create({
      model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = (message.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '{}';
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    aiResult = JSON.parse(text);
  } catch {
    // If AI call or parse fails, classify everything as Autres
    aiResult = {};
  }

  // Map each platform to its AI-assigned category (case-insensitive key lookup)
  const lower = new Map(Object.entries(aiResult).map(([k, v]) => [k.toLowerCase(), v]));
  const categoryToPlatformIds = new Map<string, string[]>();

  for (const p of platforms) {
    const category = lower.get(p.name.toLowerCase()) ?? 'Autres';
    if (!categoryToPlatformIds.has(category)) categoryToPlatformIds.set(category, []);
    categoryToPlatformIds.get(category)!.push(p.id);
  }

  // Singletons (< MIN_PLATFORMS_PER_CATEGORY) go to Autres
  const finalAssignments = new Map<string, string>(); // platformId -> finalCategory
  const categoriesToEnsure = new Set<string>();

  for (const [category, ids] of categoryToPlatformIds.entries()) {
    const finalCategory = ids.length >= MIN_PLATFORMS_PER_CATEGORY ? category : 'Autres';
    for (const id of ids) finalAssignments.set(id, finalCategory);
    categoriesToEnsure.add(finalCategory);
  }

  // Update platform.category in batch
  const updates = [...finalAssignments.entries()];
  await Promise.all(
    updates.map(([id, category]) =>
      prisma.platform.update({ where: { id }, data: { category } }).catch(() => {}),
    ),
  );

  // Upsert Category records (skip if already exists)
  await Promise.all(
    [...categoriesToEnsure].map(async (label) => {
      const exists = await prisma.category.findFirst({
        where: { organization_id: orgId, type: 'platform', label },
      });
      if (!exists) {
        await prisma.category.create({
          data: {
            id: uuidv4(),
            organization_id: orgId,
            type: 'platform',
            label,
            color: categoryColor(label),
          },
        }).catch(() => {}); // ignore race-condition duplicates
      }
    }),
  );
}
