import cron from 'node-cron';
import prisma from '../prisma/client';
import { generateAlerts } from './alert.service';
import { sendSubscriptionAlertEmail } from './email.service';

// Runs every day at 8:00 AM
export function startCronJobs(): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Daily check starting…');

    const orgs = await prisma.organization.findMany();
    for (const org of orgs) {
      // 1. Generate new alerts
      await generateAlerts(org.id);

      // 2. Send email notifications for expiring subscriptions
      await checkSubscriptionEmails(org.id);
    }

    console.log('[Cron] Daily check done.');
  });

  console.log('[Cron] Scheduled daily check at 08:00');
}

async function checkSubscriptionEmails(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return;

  const now = new Date();

  const subscriptions = await prisma.subscription.findMany({
    where: { organization_id: orgId, status: 'actif' },
  });

  // Get all admin emails for this org
  const admins = await prisma.userApp.findMany({
    where: { organization_id: orgId, role: { in: ['admin', 'manager'] } },
    select: { email: true },
  });
  const adminEmails = admins.map((a) => a.email);

  if (adminEmails.length === 0) return;

  for (const sub of subscriptions) {
    if (!sub.renewal_date) continue;

    const renewalDate = new Date(sub.renewal_date);
    const daysUntilRenewal = Math.floor(
      (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Send at 30 days, 14 days, 7 days, and 1 day before expiry
    const notifyAt = [30, 14, 7, 1];
    if (!notifyAt.includes(daysUntilRenewal)) continue;

    // Check if we already sent a notification for this threshold today
    const alreadySent = await prisma.auditTrail.findFirst({
      where: {
        organization_id: orgId,
        action: 'email.subscription_alert',
        target_id: sub.id,
        target_label: String(daysUntilRenewal),
        created_at: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    });
    if (alreadySent) continue;

    await sendSubscriptionAlertEmail({
      to: adminEmails,
      subscriptionName: sub.name,
      daysUntilRenewal,
      renewalDate: sub.renewal_date,
      vendor: sub.vendor,
      costAnnual: sub.cost_annual,
      currency: sub.currency,
      responsible: sub.responsible,
    });

    // Log the email send in audit trail to avoid duplicates
    await prisma.auditTrail.create({
      data: {
        id: `email_${sub.id}_${daysUntilRenewal}_${now.toISOString().split('T')[0]}`,
        organization_id: orgId,
        actor: 'system',
        action: 'email.subscription_alert',
        target_type: 'subscription',
        target_id: sub.id,
        target_label: String(daysUntilRenewal),
        old_value: {},
        new_value: { recipients: adminEmails, days_remaining: daysUntilRenewal },
        ip_address: '127.0.0.1',
        user_agent: 'Tracix-Cron/1.0',
      },
    });
  }
}
