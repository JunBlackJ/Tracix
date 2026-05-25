import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';
import { createAuditEntry, getClientIp } from '../middleware/audit';
import { config } from '../config';
import {
  initPayment,
  verifyPayment,
  generateNotifyToken,
  PLAN_PRICES,
} from '../services/cinetpay.service';

const router = Router();

const InitSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  months: z.number().int().min(1).max(12),
});

// POST /api/payments/initiate — créer une transaction et obtenir l'URL de paiement CinetPay
router.post('/initiate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = InitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    return;
  }

  const { plan, months } = parsed.data;
  const orgId = req.user!.organizationId;
  const userEmail = req.user!.email;

  if (!config.cinetpay.apiKey || !config.cinetpay.siteId) {
    res.status(503).json({ error: 'Paiement non configuré sur ce serveur.' });
    return;
  }

  const pricePerMonth = PLAN_PRICES[plan];
  const amount = pricePerMonth * months;
  const transactionId = `tracix_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
  const notifyToken = generateNotifyToken();

  // Récupérer le nom de l'user pour CinetPay
  const user = await prisma.userApp.findUnique({
    where: { id: req.user!.userId },
    select: { full_name: true },
  });

  // Enregistrer la transaction en DB avant de rediriger
  await (prisma as any).paymentTransaction.create({
    data: {
      id: uuidv4(),
      organization_id: orgId,
      cinetpay_txn_id: transactionId,
      plan,
      months,
      amount,
      currency: 'XOF',
      status: 'pending',
      initiated_by: userEmail,
      notify_token: notifyToken,
    },
  });

  const frontendUrl = config.frontendUrl;
  const apiUrl = config.apiUrl;

  const initRes = await initPayment({
    transactionId,
    amount,
    currency: 'XOF',
    description: `Tracix ${plan === 'pro' ? 'Pro' : 'Enterprise'} — ${months} mois`,
    notifyUrl: `${apiUrl}/api/payments/notify/${notifyToken}`,
    returnUrl: `${frontendUrl}/paiement/succes?txn=${transactionId}`,
    cancelUrl: `${frontendUrl}/paiement/echec?txn=${transactionId}`,
    customerName: user?.full_name ?? userEmail,
    customerEmail: userEmail,
    metadata: JSON.stringify({ orgId, plan, months }),
  });

  if (initRes.code !== '201' || !initRes.data?.payment_url) {
    // Marquer la transaction comme échouée
    await (prisma as any).paymentTransaction.updateMany({
      where: { cinetpay_txn_id: transactionId },
      data: { status: 'failed' },
    });
    res.status(502).json({ error: 'Échec initialisation CinetPay', details: initRes.message });
    return;
  }

  await createAuditEntry({
    organizationId: orgId,
    actor: userEmail,
    action: 'payment.initiated',
    targetType: 'payment',
    targetId: transactionId,
    targetLabel: `Plan ${plan} — ${months} mois`,
    oldValue: {},
    newValue: { plan, months, amount, currency: 'XOF' },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
  });

  res.json({ payment_url: initRes.data.payment_url, transaction_id: transactionId });
});

// POST /api/payments/notify/:token — webhook IPN CinetPay (appelé par CinetPay, pas par le client)
router.post('/notify/:token', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { cpm_trans_id } = req.body as { cpm_trans_id?: string };

  if (!cpm_trans_id) {
    res.status(400).json({ error: 'transaction_id manquant' });
    return;
  }

  // Vérifier que le token correspond bien à cette transaction (évite les faux IPN)
  const txn = await (prisma as any).paymentTransaction.findFirst({
    where: { cinetpay_txn_id: cpm_trans_id, notify_token: token },
  });

  if (!txn) {
    res.status(404).json({ error: 'Transaction introuvable ou token invalide' });
    return;
  }

  if (txn.status === 'paid') {
    // Déjà traité — répondre 200 pour éviter les retries CinetPay
    res.json({ ok: true });
    return;
  }

  // Vérifier le statut réel auprès de CinetPay
  const verify = await verifyPayment(cpm_trans_id);

  if (verify.code !== '00' || verify.data?.status !== 'ACCEPTED') {
    await (prisma as any).paymentTransaction.updateMany({
      where: { cinetpay_txn_id: cpm_trans_id },
      data: {
        status: verify.data?.status === 'CANCELLED' ? 'cancelled' : 'failed',
        payment_method: verify.data?.payment_method ?? '',
      },
    });
    res.json({ ok: true });
    return;
  }

  // Paiement accepté — activer le plan
  const now = new Date();
  const currentExpiry = await prisma.organization.findUnique({
    where: { id: txn.organization_id },
    select: { plan_expires_at: true, plan: true },
  });

  // Si le plan est déjà actif et non expiré, étendre à partir de la date d'expiration
  const baseDate = currentExpiry?.plan_expires_at && currentExpiry.plan_expires_at > now
    ? currentExpiry.plan_expires_at
    : now;

  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + txn.months);

  await prisma.organization.update({
    where: { id: txn.organization_id },
    data: { plan: txn.plan, plan_expires_at: newExpiry },
  });

  await (prisma as any).paymentTransaction.updateMany({
    where: { cinetpay_txn_id: cpm_trans_id },
    data: {
      status: 'paid',
      payment_method: verify.data?.payment_method ?? '',
      paid_at: now,
    },
  });

  await createAuditEntry({
    organizationId: txn.organization_id,
    actor: txn.initiated_by,
    action: 'payment.confirmed',
    targetType: 'payment',
    targetId: cpm_trans_id,
    targetLabel: `Plan ${txn.plan} — ${txn.months} mois`,
    oldValue: { plan: currentExpiry?.plan },
    newValue: { plan: txn.plan, plan_expires_at: newExpiry.toISOString(), amount: txn.amount, payment_method: verify.data?.payment_method },
    ipAddress: '',
    userAgent: 'CinetPay-IPN',
  });

  console.log(`[Payment] Confirmed: ${cpm_trans_id} — ${txn.organization_id} → plan ${txn.plan} until ${newExpiry.toISOString()}`);
  res.json({ ok: true });
});

// GET /api/payments/status/:txnId — vérifier le statut d'une transaction (polling frontend)
router.get('/status/:txnId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const txn = await (prisma as any).paymentTransaction.findFirst({
    where: { cinetpay_txn_id: req.params.txnId, organization_id: orgId },
    select: { status: true, plan: true, months: true, amount: true, payment_method: true, paid_at: true },
  });

  if (!txn) {
    res.status(404).json({ error: 'Transaction introuvable' });
    return;
  }

  res.json(txn);
});

// GET /api/payments/history — historique des paiements de l'org
router.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const transactions = await (prisma as any).paymentTransaction.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: {
      id: true, cinetpay_txn_id: true, plan: true, months: true,
      amount: true, currency: true, status: true, payment_method: true,
      initiated_by: true, created_at: true, paid_at: true,
    },
  });

  res.json(transactions);
});

export default router;
