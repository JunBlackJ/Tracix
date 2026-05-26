import { FedaPay, Transaction } from 'fedapay';
import { config } from '../config';

export function initFedaPay() {
  (FedaPay as any).setApiKey(config.fedapay.secretKey);
  (FedaPay as any).setEnvironment(config.fedapay.sandbox ? 'sandbox' : 'live');
}

export interface FedaPayInitOptions {
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  callbackUrl: string;
}

export interface FedaPayInitResult {
  transactionId: number;
  token: string;
  paymentUrl: string;
}

export async function createFedaPayTransaction(opts: FedaPayInitOptions): Promise<FedaPayInitResult> {
  initFedaPay();

  const nameParts = opts.customerName.trim().split(' ');
  const firstname = nameParts[0] ?? 'Client';
  const lastname = nameParts.slice(1).join(' ') || '-';

  const transaction = await (Transaction as any).create({
    description: opts.description,
    amount: opts.amount,
    currency: { iso: opts.currency },
    callback_url: opts.callbackUrl,
    customer: {
      firstname,
      lastname,
      email: opts.customerEmail,
    },
  });

  const token = await transaction.generateToken();

  return {
    transactionId: transaction.id,
    token: token.token,
    paymentUrl: token.url,
  };
}

export async function getFedaPayTransaction(transactionId: number): Promise<{
  id: number;
  status: string;
  amount: number;
  currency: string;
  payment_method?: string;
}> {
  initFedaPay();
  const txn = await (Transaction as any).retrieve(transactionId);
  return {
    id: txn.id,
    status: txn.status,
    amount: txn.amount,
    currency: txn.currency?.iso ?? 'XOF',
    payment_method: txn.payment_method?.name,
  };
}
