import { Router, Request, Response } from 'express';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// POST /api/reports/generate — rédige le rapport de conformité via IA
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const awsRegion = process.env.AWS_REGION;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
    res.status(503).json({ error: 'AWS credentials not configured' });
    return;
  }

  const {
    orgName,
    reportDate,
    members,
    platforms,
    accessRights,
    subscriptions,
    systems,
    alerts,
    score,
    indicators,
  } = req.body;

  const prompt = `Tu es un expert en gouvernance IT et cybersécurité. Tu rédiges un rapport de conformité professionnel pour l'organisation "${orgName}" en date du ${reportDate}.

Voici les données brutes :

INDICATEURS CLÉS :
${JSON.stringify(indicators, null, 2)}

SCORE GLOBAL DE CONFORMITÉ : ${score}/100

MEMBRES (${members.length} total, ${members.filter((m: { status: string }) => m.status === 'actif').length} actifs) :
- Équipes : ${[...new Set(members.map((m: { team: string }) => m.team))].join(', ')}
- Types de comptes : ${members.reduce((acc: Record<string, number>, m: { account_type: string }) => { acc[m.account_type] = (acc[m.account_type] || 0) + 1; return acc; }, {})}
- Score risque moyen : ${members.length ? Math.round(members.reduce((s: number, m: { risk_score: number }) => s + m.risk_score, 0) / members.length) : 'N/A'}
- Top 5 à risque : ${[...members].sort((a: { risk_score: number }, b: { risk_score: number }) => a.risk_score - b.risk_score).slice(0, 5).map((m: { full_name: string; risk_score: number }) => `${m.full_name} (${m.risk_score})`).join(', ')}

PLATEFORMES (${platforms.length} total) :
- Sans MFA : ${platforms.filter((p: { has_mfa: boolean }) => !p.has_mfa).map((p: { name: string }) => p.name).join(', ') || 'Aucune'}
- Environnements : ${platforms.reduce((acc: Record<string, number>, p: { environment: string }) => { acc[p.environment] = (acc[p.environment] || 0) + 1; return acc; }, {})}

DROITS D'ACCÈS (${accessRights.length} total) :
- Niveaux : ${accessRights.reduce((acc: Record<string, number>, a: { level: string }) => { acc[a.level] = (acc[a.level] || 0) + 1; return acc; }, {})}
- Revues en retard : ${accessRights.filter((a: { next_review_date: string; level: string }) => a.next_review_date && new Date(a.next_review_date) < new Date() && a.level !== 'none').length}

ABONNEMENTS (${subscriptions.length} total) :
- Coût annuel total : ${subscriptions.reduce((s: number, sub: { cost_annual: number; currency: string }) => s + (sub.currency === 'EUR' ? sub.cost_annual : sub.cost_annual / 1.08), 0).toFixed(0)} EUR
- Expirant sous 30j : ${subscriptions.filter((s: { renewal_date: string; status: string }) => { if (!s.renewal_date || s.status !== 'actif') return false; return Math.floor((new Date(s.renewal_date).getTime() - Date.now()) / 86400000) <= 30; }).map((s: { name: string }) => s.name).join(', ') || 'Aucun'}

SYSTÈMES (${systems.length} total) :
- Fin de support <90j : ${systems.filter((s: { end_of_support_date: string }) => { if (!s.end_of_support_date) return false; return Math.floor((new Date(s.end_of_support_date).getTime() - Date.now()) / 86400000) <= 90; }).map((s: { hostname: string }) => s.hostname).join(', ') || 'Aucun'}

ALERTES : ${alerts.filter((a: { is_resolved: boolean }) => !a.is_resolved).length} actives (${alerts.filter((a: { is_resolved: boolean; severity: string }) => !a.is_resolved && a.severity === 'critical').length} critiques)

---

Rédige un rapport structuré en JSON avec exactement ces clés. Chaque valeur est un texte rédigé, professionnel, factuel, en français, entre 2 et 6 phrases. Utilise les chiffres réels fournis. IMPORTANT : ne mets jamais de markdown (pas de ** ni #), jamais d'entités HTML (écris directement les caractères : & pas &amp;, ' pas &#x27;, etc.), jamais de balises XML ou HTML.

Réponds UNIQUEMENT avec du JSON valide :
{
  "executiveSummary": "Synthèse de 4-5 phrases pour un RSSI ou DSI : état global de la gouvernance IT, points forts, points d'amélioration prioritaires et recommandation principale.",
  "accessControl": "Analyse de la maturité de la gestion des accès : répartition des niveaux, risques Admin, état des revues, conformité MFA. Mentionner les chiffres clés.",
  "riskAnalysis": "Analyse du score de risque global et des membres les plus à risque. Identifier les patterns de risque et recommander des actions concrètes.",
  "subscriptionGovernance": "État du portefeuille d'abonnements : coût total, risques d'expiration, recommandations sur la gestion des renouvellements.",
  "systemCompliance": "État de la conformité des systèmes : fins de support, patchs, criticité. Risques identifiés et actions recommandées.",
  "alertsSummary": "Synthèse des alertes actives : répartition par sévérité, modules concernés, urgences à traiter en priorité.",
  "recommendations": "Liste de 4 à 6 recommandations prioritaires numérotées, concrètes et actionnables, classées par urgence décroissante.",
  "conclusion": "Conclusion de 3-4 phrases : bilan global, tendance de conformité, prochaines étapes suggérées."
}`;

  const client = new AnthropicBedrock({
    awsRegion,
    awsAccessKey: awsAccessKeyId,
    awsSecretKey: awsSecretAccessKey,
  });

  const message = await client.messages.create({
    model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  console.log('[Reports] Raw AI response (first 500 chars):', raw.substring(0, 500));
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  const sections = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));

  // Decode HTML entities (run twice to handle double-encoding like &amp;amp;)
  const decodeOnce = (s: string): string =>
    s.replace(/&amp;/g, '&')
     .replace(/&lt;/g, '<')
     .replace(/&gt;/g, '>')
     .replace(/&quot;/g, '"')
     .replace(/&#x27;/g, "'")
     .replace(/&#39;/g, "'")
     .replace(/&apos;/g, "'")
     .replace(/&laquo;/g, '«')
     .replace(/&raquo;/g, '»')
     .replace(/&eacute;/g, 'é')
     .replace(/&egrave;/g, 'è')
     .replace(/&agrave;/g, 'à')
     .replace(/&ccedil;/g, 'ç')
     .replace(/&ocirc;/g, 'ô')
     .replace(/&ecirc;/g, 'ê')
     .replace(/&ucirc;/g, 'û')
     .replace(/&icirc;/g, 'î')
     .replace(/&rsquo;/g, "'")
     .replace(/&lsquo;/g, "'")
     .replace(/&rdquo;/g, '"')
     .replace(/&ldquo;/g, '"')
     .replace(/&ndash;/g, '–')
     .replace(/&mdash;/g, '—')
     .replace(/&nbsp;/g, ' ')
     .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
     .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // Strip markdown and unwanted symbols
  const stripMarkdown = (s: string): string =>
    s.replace(/\*\*/g, '')
     .replace(/\*/g, '')
     .replace(/^#{1,6}\s*/gm, '')
     .replace(/^[-•]\s*/gm, '- ')
     .replace(/`([^`]+)`/g, '$1')
     .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const clean: Record<string, string> = {};
  for (const [key, val] of Object.entries(sections)) {
    if (typeof val !== 'string') { clean[key] = String(val); continue; }
    // Decode twice to handle double-encoded entities
    let text = decodeOnce(decodeOnce(val));
    text = stripMarkdown(text);
    // Remove any remaining &xxx; patterns that look like broken entities
    text = text.replace(/&[a-zA-Z]{2,10};/g, (match) => {
      // If it's still an entity after two decode passes, replace with empty or known char
      const fallback: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>' };
      return fallback[match] ?? '';
    });
    clean[key] = text.trim();
  }

  res.json(clean);
});

export default router;
