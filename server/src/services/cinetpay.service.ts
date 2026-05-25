import crypto from 'crypto';
import { config } from '../config';

export const CINETPAY_API = 'https://api-checkout.cinetpay.com/v2';

export interface CinetPayInitResponse {
  code: string;
  message: string;
  data?: {
    payment_token: string;
    payment_url: string;
  };
}

export interface CinetPayVerifyResponse {
  code: string;
  message: string;
  data?: {
    status: string;          // 'ACCEPTED' | 'REFUSED' | 'CANCELLED' | 'PENDING'
    payment_method: string;
    amount: number;
    currency: string;
    metadata: string;
  };
}

// Prix en XOF par plan et par mois
export const PLAN_PRICES: Record<string, number> = {
  pro: 30_000,        // 30 000 XOF / mois ≈ 45 €
  enterprise: 90_000, // 90 000 XOF / mois ≈ 137 €
};

export function generateNotifyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function initPayment(opts: {
  transactionId: string;
  amount: number;
  currency: string;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  cancelUrl: string;
  customerName: string;
  customerEmail: string;
  metadata: string;
}): Promise<CinetPayInitResponse> {
  const body = {
    apikey: config.cinetpay.apiKey,
    site_id: config.cinetpay.siteId,
    transaction_id: opts.transactionId,
    amount: opts.amount,
    currency: opts.currency,
    description: opts.description,
    notify_url: opts.notifyUrl,
    return_url: opts.returnUrl,
    cancel_url: opts.cancelUrl,
    customer_name: opts.customerName,
    customer_email: opts.customerEmail,
    metadata: opts.metadata,
    channels: 'ALL', // Wave CI, Orange Money, MTN, Moov, Visa, Mastercard
    lang: 'fr',
  };

  const res = await fetch(`${CINETPAY_API}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json() as Promise<CinetPayInitResponse>;
}

export async function verifyPayment(transactionId: string): Promise<CinetPayVerifyResponse> {
  const res = await fetch(`${CINETPAY_API}/payment/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: config.cinetpay.apiKey,
      site_id: config.cinetpay.siteId,
      transaction_id: transactionId,
    }),
  });

  return res.json() as Promise<CinetPayVerifyResponse>;
}
