import { v4 as uuidv4 } from 'uuid';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import prisma from '../prisma/client';

const MIN_PLATFORMS_PER_CATEGORY = 2;

const CATEGORY_COLORS: Record<string, string> = {
  // Technologique / développeurs
  'Cloud':              '#3B82F6',
  'DevOps':             '#8B5CF6',
  'Développement':      '#6366F1',
  'Infrastructure':     '#64748B',
  'Identité':           '#A855F7',
  'OS':                 '#0EA5E9',
  'App Store':          '#06B6D4',
  // SaaS / productivité
  'Productivité':       '#F59E0B',
  'Collaboration':      '#0284C7',
  'CRM':                '#F97316',
  'Design':             '#EC4899',
  'Support':            '#FB923C',
  'RH':                 '#D946EF',
  // Sécurité / IT
  'Sécurité':           '#EF4444',
  'Monitoring':         '#14B8A6',
  'Données':            '#10B981',
  // Commerce
  'E-commerce':         '#84CC16',
  'Marketplace':        '#65A30D',
  'Livraison':          '#A3E635',
  // Mise en relation
  'Transport':          '#FBBF24',
  'Hébergement':        '#F59E0B',
  'Freelance':          '#EAB308',
  // Contenu / médias
  'Réseaux sociaux':    '#E879F9',
  'Streaming':          '#C026D3',
  'Médias':             '#A21CAF',
  // Paiement / fintech
  'Finance':            '#34D399',
  'Paiement':           '#10B981',
  'Crypto':             '#6EE7B7',
  // Apprentissage
  'Formation':          '#818CF8',
  'Éducation':          '#6366F1',
  // Fallback
  'Communication':      '#2DD4BF',
  'Autres':             '#6B7280',
};

function categoryColor(label: string): string {
  return CATEGORY_COLORS[label] ?? '#6B7280';
}

/**
 * For platforms that already have a category (from Excel), ensure a Category
 * record exists so the UI can display and filter by it.
 * Excel-provided categories are always respected as-is — no renaming or merging.
 */
export async function ensureExcelCategories(orgId: string): Promise<void> {
  const platforms = await prisma.platform.findMany({
    where: { organization_id: orgId, NOT: { category: '' } },
    select: { category: true },
  });
  if (platforms.length === 0) return;

  const labels = [...new Set(platforms.map((p) => p.category.trim()).filter(Boolean))];

  await Promise.all(
    labels.map(async (label) => {
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
        }).catch(() => {});
      }
    }),
  );
}

/**
 * For platforms with no category, call Claude to assign one, then group:
 * - categories with >= MIN_PLATFORMS_PER_CATEGORY platforms → keep the category name
 * - singletons → moved to "Autres"
 * Excel-provided categories (category != '') are never touched here.
 */
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
  const prompt = `Tu es un expert en classification de plateformes numériques. Classe chacun des outils/plateformes suivants dans la catégorie la plus appropriée.

Outils à classifier :
${nameList}

Catégories disponibles (choisis celle qui correspond le mieux à la FONCTION PRINCIPALE) :

Technologique / développeurs :
- "Cloud" : AWS, GCP, Azure, hébergement cloud
- "DevOps" : CI/CD, Git, Docker, déploiement, monitoring infra
- "Développement" : IDE, SDK, outils de code, API dev, GitHub, GitLab
- "Infrastructure" : serveurs, réseau, virtualisation, datacenter
- "Identité" : SSO, IAM, annuaires, Okta, Active Directory
- "OS" : systèmes d'exploitation, Windows, Linux, Android, iOS
- "App Store" : Google Play Store, Apple App Store, distribution d'apps

SaaS / productivité :
- "Productivité" : Notion, Google Workspace, Office 365, Trello, Asana
- "Collaboration" : Slack, Teams, Discord, wikis internes
- "CRM" : Salesforce, HubSpot, Pipedrive, gestion client
- "Design" : Figma, Canva, Adobe, outils créatifs
- "Support" : Zendesk, Intercom, helpdesk, ticketing
- "RH" : recrutement, paie, gestion RH, BambooHR, Workday
- "Monitoring" : Datadog, Splunk, New Relic, alertes, logs
- "Données" : BI, analytics, data warehouse, Tableau, Snowflake
- "Sécurité" : SIEM, antivirus, firewall, gestion des accès, VPN
- "Communication" : messagerie, email, Twilio, SendGrid

Commerce :
- "E-commerce" : Shopify, WooCommerce, boutiques en ligne
- "Marketplace" : Amazon, eBay, Etsy, places de marché
- "Livraison" : Uber Eats, Glovo, livraison à domicile

Mise en relation :
- "Transport" : Uber, Bolt, mobilité, VTC
- "Hébergement" : Airbnb, Booking, location courte durée
- "Freelance" : Upwork, Fiverr, malt, travail indépendant

Contenu / médias :
- "Réseaux sociaux" : Instagram, TikTok, Facebook, X/Twitter, LinkedIn
- "Streaming" : Netflix, Spotify, YouTube, médias à la demande
- "Médias" : presse en ligne, blogs, newsletters, podcasts

Paiement / fintech :
- "Paiement" : PayPal, Stripe, Wave, terminaux de paiement
- "Crypto" : Binance, Coinbase, wallets crypto, DeFi
- "Finance" : banques, comptabilité, facturation, ERP financier

Apprentissage :
- "Formation" : Udemy, Coursera, LinkedIn Learning, MOOCs
- "Éducation" : Google Classroom, Moodle, outils scolaires/universitaires

Règles :
- Une seule catégorie par outil, basée sur sa fonction principale
- Si l'outil est inconnu ou vraiment ambigu après réflexion, assigne "Autres"
- Priorise toujours la fonction métier réelle sur la technologie sous-jacente

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
