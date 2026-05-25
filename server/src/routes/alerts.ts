import { Router, Request, Response } from 'express';
import { z } from 'zod';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { generateAlerts } from '../services/alert.service';

const router = Router();
router.use(requireAuth);

// In-memory AI advice usage: "orgId:YYYY-MM" -> count
const aiAdviceUsage = new Map<string, number>();
const FREE_ADVICE_LIMIT = 3;

const ALERT_TYPE_LABELS: Record<string, string> = {
  access_review_overdue: "Revue d'accès dépassée",
  admin_count_high: "Trop d'administrateurs",
  member_offboarding: 'Membre à désactiver (offboarding)',
  orphan_account: 'Compte orphelin détecté',
  no_mfa_on_admin: 'MFA manquant sur un administrateur',
  shared_account_admin: 'Compte partagé avec droits admin',
  subscription_expiring: 'Abonnement expirant bientôt',
  subscription_expired: 'Abonnement expiré',
  system_end_of_support: 'Fin de support système imminente',
  system_not_patched: 'Système non patché',
  flow_review_overdue: 'Revue de flux réseau dépassée',
};

// GET /api/alerts
router.get('/', requirePermission('alerts.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { is_resolved, severity, type, source_module } = req.query;

  const where: Record<string, unknown> = { organization_id: orgId };
  if (is_resolved !== undefined) where.is_resolved = is_resolved === 'true';
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (source_module) where.source_module = source_module;

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: [{ is_resolved: 'asc' }, { created_at: 'desc' }],
  });

  res.json(alerts);
});

// GET /api/alerts/:id
router.get('/:id', requirePermission('alerts.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const alert = await prisma.alert.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });

  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  res.json(alert);
});

// PATCH /api/alerts/resolve-all  — must be before /:id/resolve to avoid :id matching "resolve-all"
router.patch('/resolve-all', requirePermission('alerts.resolve'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const body = z.object({ ids: z.array(z.string()) }).parse(req.body);

  // Verify all alerts belong to org
  const alertsToResolve = await prisma.alert.findMany({
    where: {
      id: { in: body.ids },
      organization_id: orgId,
      is_resolved: false,
    },
  });

  if (alertsToResolve.length === 0) {
    res.json({ resolved: 0 });
    return;
  }

  const today = new Date().toISOString();
  const result = await prisma.alert.updateMany({
    where: {
      id: { in: alertsToResolve.map((a) => a.id) },
      organization_id: orgId,
    },
    data: {
      is_resolved: true,
      resolved_by: req.user!.email,
      resolved_at: today,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'alert.bulk_resolved',
    targetType: 'alert',
    targetId: 'bulk',
    targetLabel: `${result.count} alertes résolues`,
    oldValue: {},
    newValue: { resolved_count: result.count, ids: body.ids },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ resolved: result.count });
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', requirePermission('alerts.resolve'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const existing = await prisma.alert.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  const today = new Date().toISOString();
  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: {
      is_resolved: true,
      resolved_by: req.user!.email,
      resolved_at: today,
    },
  });

  await createAuditEntry({
    organizationId: orgId,
    actor: req.user!.email,
    action: 'alert.resolved',
    targetType: 'alert',
    targetId: alert.id,
    targetLabel: alert.message.slice(0, 60),
    oldValue: { is_resolved: false },
    newValue: { is_resolved: true, resolved_by: req.user!.email, resolved_at: today },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json(alert);
});

// POST /api/alerts/:id/advice — AI advice for an alert
router.post('/:id/advice', requirePermission('alerts.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const alert = await prisma.alert.findFirst({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  // Check plan limit for free plan
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const plan = org?.plan ?? 'free';
  if (plan === 'free') {
    const monthKey = `${orgId}:${new Date().toISOString().slice(0, 7)}`;
    const used = aiAdviceUsage.get(monthKey) ?? 0;
    if (used >= FREE_ADVICE_LIMIT) {
      res.status(429).json({ error: `Limite atteinte — ${FREE_ADVICE_LIMIT} conseils IA par mois sur le plan gratuit. Passez à Pro pour continuer.`, limitReached: true, used, limit: FREE_ADVICE_LIMIT });
      return;
    }
    aiAdviceUsage.set(monthKey, used + 1);
  }

  const awsRegion = process.env.AWS_REGION;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
    res.status(503).json({ error: "Service IA non configuré sur ce serveur." });
    return;
  }

  const client = new AnthropicBedrock({ awsRegion, awsAccessKey: awsAccessKeyId, awsSecretKey: awsSecretAccessKey });

  const typeLabel = ALERT_TYPE_LABELS[alert.type] ?? alert.type;
  const sevLabel = alert.severity === 'critical' ? 'Critique' : alert.severity === 'warning' ? 'Élevé' : 'Moyen';

  const prompt = `Tu es un expert en cybersécurité et gouvernance des accès. Un responsable sécurité consulte une alerte dans son tableau de bord Tracix (outil de gestion des habilitations).

Alerte :
- Type : ${typeLabel}
- Sévérité : ${sevLabel}
- Source : ${alert.source_label} (module ${alert.source_module})
- Message : ${alert.message}

Donne un conseil pratique, court (3-5 phrases max), en français, pour résoudre cette alerte. Commence directement par l'action à entreprendre. Sois concis et opérationnel. Pas d'introduction, pas de titre.`;

  try {
    const message = await client.messages.create({
      model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const advice = (message.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.trim() ?? "Impossible de générer un conseil pour le moment.";

    const monthKey = `${orgId}:${new Date().toISOString().slice(0, 7)}`;
    const usedNow = aiAdviceUsage.get(monthKey) ?? (plan !== 'free' ? 0 : FREE_ADVICE_LIMIT);
    const remaining = plan === 'free' ? Math.max(0, FREE_ADVICE_LIMIT - usedNow) : -1;

    res.json({ advice, remaining, limit: plan === 'free' ? FREE_ADVICE_LIMIT : -1 });
  } catch {
    res.status(500).json({ error: "Erreur lors de la génération du conseil IA." });
  }
});

// POST /api/alerts/generate — trigger alert engine
router.post('/generate', requirePermission('alerts.generate'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  await generateAlerts(orgId);
  const alerts = await prisma.alert.findMany({
    where: { organization_id: orgId, is_resolved: false },
    orderBy: { created_at: 'desc' },
  });
  res.json({ generated: true, alerts });
});

export default router;
