import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return transporter;
}

export async function sendSubscriptionAlertEmail(opts: {
  to: string[];
  subscriptionName: string;
  daysUntilRenewal: number;
  renewalDate: string;
  vendor: string;
  costAnnual: number;
  currency: string;
  responsible: string;
}): Promise<void> {
  if (!config.email.user || !config.email.pass) {
    console.warn('[Email] SMTP non configuré — email non envoyé pour', opts.subscriptionName);
    return;
  }

  const urgency = opts.daysUntilRenewal <= 7 ? 'URGENT' : opts.daysUntilRenewal <= 14 ? 'Important' : 'Rappel';
  const urgencyColor = opts.daysUntilRenewal <= 7 ? '#E24B4A' : opts.daysUntilRenewal <= 14 ? '#EF9F27' : '#534AB7';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#534AB7;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">Tracix</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Plateforme de gouvernance IT</p>
          </td>
        </tr>

        <!-- Badge urgency -->
        <tr>
          <td style="padding:24px 32px 0;">
            <span style="display:inline-block;background:${urgencyColor};color:#fff;font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px;text-transform:uppercase;">${urgency}</span>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:16px 32px 0;">
            <h1 style="margin:0;font-size:22px;color:#111827;">Renouvellement dans <span style="color:${urgencyColor};">${opts.daysUntilRenewal} jour${opts.daysUntilRenewal > 1 ? 's' : ''}</span></h1>
            <p style="margin:8px 0 0;font-size:15px;color:#6B7280;">L'abonnement <strong>${opts.subscriptionName}</strong> arrive à échéance le <strong>${opts.renewalDate}</strong>.</p>
          </td>
        </tr>

        <!-- Details card -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #E5E7EB;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6B7280;width:40%;">Fournisseur</td>
                      <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${opts.vendor}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6B7280;">Date de renouvellement</td>
                      <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${opts.renewalDate}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6B7280;">Coût annuel</td>
                      <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${opts.costAnnual.toLocaleString('fr-FR')} ${opts.currency}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6B7280;">Responsable</td>
                      <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${opts.responsible}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Action -->
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0 0 16px;font-size:14px;color:#374151;">Connectez-vous à Tracix pour gérer cet abonnement :</p>
            <a href="${config.frontendUrl}/abonnements" style="display:inline-block;background:#534AB7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Voir les abonnements →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F3F4F6;padding:16px 32px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">Ce message a été envoyé automatiquement par Tracix. Ne pas répondre à cet email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await getTransporter().sendMail({
    from: config.email.from,
    to: opts.to.join(', '),
    subject: `[Tracix] ${urgency} — Renouvellement ${opts.subscriptionName} dans ${opts.daysUntilRenewal}j`,
    html,
  });

  console.log(`[Email] Alerte abonnement envoyée pour ${opts.subscriptionName} → ${opts.to.join(', ')}`);
}
