import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { config } from '../config';
import { createFedaPayTransaction, getFedaPayTransaction } from '../services/fedapay.service';

const router = Router();

const PLAN_PRICES: Record<string, number> = { pro: 30_000, enterprise: 90_000 };
const MONTH_DISCOUNTS: Record<number, number> = { 1: 0, 3: 5, 6: 10, 12: 20, 24: 30, 36: 40 };

const InitSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  months: z.number().int().refine((m) => [1, 3, 6, 12, 24, 36].includes(m), {
    message: 'Durée invalide',
  }),
});

// POST /api/fedapay/initiate
router.post('/initiate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = InitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  if (!config.fedapay.secretKey) {
    res.status(503).json({ error: 'FedaPay non configuré sur ce serveur.' });
    return;
  }

  const { plan, months } = parsed.data;
  const orgId = req.user!.organizationId;
  const userEmail = req.user!.email;

  const pricePerMonth = PLAN_PRICES[plan];
  const discount = MONTH_DISCOUNTS[months] ?? 0;
  const base = pricePerMonth * months;
  const amount = base - Math.round(base * discount / 100);

  const user = await prisma.userApp.findUnique({
    where: { id: req.user!.userId },
    select: { full_name: true },
  });

  const frontendUrl = config.frontendUrl;
  const internalId = uuidv4();

  try {
    const result = await createFedaPayTransaction({
      amount,
      currency: 'XOF',
      description: `Tracix ${plan === 'pro' ? 'Pro' : 'Enterprise'} — ${months} mois`,
      customerName: user?.full_name ?? userEmail,
      customerEmail: userEmail,
      callbackUrl: `${frontendUrl}/paiement/succes?provider=fedapay&txn=${internalId}`,
    });

    await (prisma as any).paymentTransaction.create({
      data: {
        id: internalId,
        organization_id: orgId,
        cinetpay_txn_id: `feda_${result.transactionId}`,
        plan,
        months,
        amount,
        currency: 'XOF',
        status: 'pending',
        initiated_by: userEmail,
        notify_token: result.token,
      },
    });

    await createAuditEntry({
      organizationId: orgId,
      actor: userEmail,
      action: 'payment.initiated',
      targetType: 'payment',
      targetId: internalId,
      targetLabel: `FedaPay — Plan ${plan} — ${months} mois`,
      oldValue: {},
      newValue: { plan, months, amount, currency: 'XOF', provider: 'fedapay' },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });

    res.json({ payment_url: result.paymentUrl, transaction_id: internalId });
  } catch (err: any) {
    console.error('[FedaPay] initiate error:', err?.message ?? err);
    res.status(502).json({ error: 'Échec initialisation FedaPay', details: err?.message });
  }
});

// POST /api/fedapay/webhook — événements FedaPay
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const event = req.body as { name?: string; data?: { transaction?: { id?: number; status?: string; amount?: number; payment_method?: { name?: string } } } };

  if (event.name !== 'transaction.approved') {
    res.json({ ok: true });
    return;
  }

  const fedaTxnId = event.data?.transaction?.id;
  const status = event.data?.transaction?.status;

  if (!fedaTxnId || status !== 'approved') {
    res.json({ ok: true });
    return;
  }

  const txn = await (prisma as any).paymentTransaction.findFirst({
    where: { cinetpay_txn_id: `feda_${fedaTxnId}` },
  });

  if (!txn || txn.status === 'paid') {
    res.json({ ok: true });
    return;
  }

  const now = new Date();
  const currentOrg = await prisma.organization.findUnique({
    where: { id: txn.organization_id },
    select: { plan_expires_at: true, plan: true },
  });

  const baseDate = currentOrg?.plan_expires_at && currentOrg.plan_expires_at > now
    ? currentOrg.plan_expires_at
    : now;

  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + txn.months);

  await prisma.organization.update({
    where: { id: txn.organization_id },
    data: { plan: txn.plan, plan_expires_at: newExpiry },
  });

  await (prisma as any).paymentTransaction.updateMany({
    where: { cinetpay_txn_id: `feda_${fedaTxnId}` },
    data: {
      status: 'paid',
      payment_method: event.data?.transaction?.payment_method?.name ?? '',
      paid_at: now,
    },
  });

  await createAuditEntry({
    organizationId: txn.organization_id,
    actor: txn.initiated_by,
    action: 'payment.confirmed',
    targetType: 'payment',
    targetId: txn.id,
    targetLabel: `FedaPay — Plan ${txn.plan} — ${txn.months} mois`,
    oldValue: { plan: currentOrg?.plan },
    newValue: { plan: txn.plan, plan_expires_at: newExpiry.toISOString(), provider: 'fedapay' },
    ipAddress: '',
    userAgent: 'FedaPay-Webhook',
  });

  console.log(`[FedaPay] Confirmed: feda_${fedaTxnId} — ${txn.organization_id} → plan ${txn.plan} until ${newExpiry.toISOString()}`);
  res.json({ ok: true });
});

// GET /api/fedapay/status/:internalId — polling frontend
router.get('/status/:internalId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const txn = await (prisma as any).paymentTransaction.findFirst({
    where: { id: req.params.internalId, organization_id: orgId },
    select: { status: true, plan: true, months: true, amount: true, payment_method: true, paid_at: true, cinetpay_txn_id: true },
  });

  if (!txn) {
    res.status(404).json({ error: 'Transaction introuvable' });
    return;
  }

  // Si toujours pending, vérifier en temps réel chez FedaPay
  if (txn.status === 'pending' && txn.cinetpay_txn_id?.startsWith('feda_')) {
    try {
      const fedaTxnId = parseInt(txn.cinetpay_txn_id.replace('feda_', ''), 10);
      const live = await getFedaPayTransaction(fedaTxnId);
      if (live.status === 'approved') {
        // Déclencher l'activation (même logique que webhook)
        const now = new Date();
        const currentOrg = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { plan_expires_at: true },
        });
        const baseDate = currentOrg?.plan_expires_at && currentOrg.plan_expires_at > now
          ? currentOrg.plan_expires_at : now;
        const newExpiry = new Date(baseDate);
        newExpiry.setMonth(newExpiry.getMonth() + txn.months);

        await prisma.organization.update({
          where: { id: orgId },
          data: { plan: txn.plan, plan_expires_at: newExpiry },
        });
        await (prisma as any).paymentTransaction.updateMany({
          where: { cinetpay_txn_id: txn.cinetpay_txn_id },
          data: { status: 'paid', payment_method: live.payment_method ?? '', paid_at: now },
        });

        res.json({ status: 'paid', plan: txn.plan, months: txn.months, amount: txn.amount, payment_method: live.payment_method, paid_at: now });
        return;
      }
    } catch {
      // échec silencieux — on renvoie le status DB
    }
  }

  res.json(txn);
});

export default router;
