import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'Tracix <onboarding@resend.dev>';

const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critique', color: '#DC2626', bg: '#FEF2F2' },
  warning:  { label: 'Attention', color: '#D97706', bg: '#FFFBEB' },
  info:     { label: 'Info',      color: '#2563EB', bg: '#EFF6FF' },
};

const TYPE_LABELS: Record<string, string> = {
  member_offboarding:    'Départ non traité',
  no_mfa_on_admin:       'Admin sans MFA',
  admin_count_high:      'Trop d\'admins',
  access_review_overdue: 'Revue en retard',
  subscription_expiring: 'Abonnement expirant',
  subscription_expired:  'Abonnement expiré',
  system_end_of_support: 'Fin de support système',
  shared_account_admin:  'Compte partagé Admin',
};

export async function sendAlertEmail(opts: {
  to: string;
  orgName: string;
  alerts: { type: string; severity: string; message: string; source_label: string }[];
  frontendUrl: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY non configuré — email non envoyé');
    return;
  }

  const criticalCount = opts.alerts.filter((a) => a.severity === 'critical').length;
  const subject = criticalCount > 0
    ? `[Tracix] ⚠ ${criticalCount} alerte${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''} — ${opts.orgName}`
    : `[Tracix] ${opts.alerts.length} alerte${opts.alerts.length > 1 ? 's' : ''} — ${opts.orgName}`;

  const rows = opts.alerts.map((a) => {
    const sev = SEVERITY_META[a.severity] ?? SEVERITY_META.info;
    const typeLabel = TYPE_LABELS[a.type] ?? a.type;
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6;vertical-align:top;white-space:nowrap;">
          <span style="display:inline-block;background:${sev.bg};color:${sev.color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${sev.label}</span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6;vertical-align:top;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${typeLabel}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6B7280;">${a.source_label}</p>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6;vertical-align:top;font-size:12px;color:#374151;">${a.message}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
      <tr>
        <td style="background:linear-gradient(135deg,#534AB7,#3C3489);padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">Tracix</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px;">Rapport d'alertes — ${opts.orgName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">
            ${opts.alerts.length} alerte${opts.alerts.length > 1 ? 's' : ''} détectée${opts.alerts.length > 1 ? 's' : ''}
          </p>
          ${criticalCount > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:#DC2626;font-weight:600;">⚠ ${criticalCount} critique${criticalCount > 1 ? 's' : ''} — action requise</p>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#F9FAFB;">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;width:90px;">Sévérité</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;">Type</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;">Détail</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;">
          <a href="${opts.frontendUrl}/alertes" style="display:inline-block;background:#534AB7;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">
            Voir les alertes →
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#F9FAFB;padding:14px 32px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:11px;color:#9CA3AF;">Envoyé automatiquement par Tracix. Pour modifier vos préférences : Paramètres → Notifications.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await resend.emails.send({ from: FROM, to: opts.to, subject, html });
  console.log(`[Email] Alertes envoyées (${opts.alerts.length}) → ${opts.to}`);
}
