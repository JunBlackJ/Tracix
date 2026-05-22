import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { generateAlerts } from './alert.service';
import { sendSubscriptionAlertEmail, sendCriticalAlertsEmail } from './email.service';

// Runs every day at 8:00 AM
export function startCronJobs(): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Daily check starting…');

    const orgs = await prisma.organization.findMany();
    for (const org of orgs) {
      // 1. Auto-offboard departed members
      await processOffboarding(org.id);

      // 2. Generate new alerts
      await generateAlerts(org.id);

      // 3. Send email notifications for expiring subscriptions
      await checkSubscriptionEmails(org.id);

      // 4. Send email digest for new critical/warning alerts
      await checkCriticalAlertEmails(org.id, org.name);
    }

    console.log('[Cron] Daily check done.');
  });

  console.log('[Cron] Scheduled daily check at 08:00');
}

export async function processOffboarding(orgId: string): Promise<number> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const departed = await prisma.member.findMany({
    where: {
      organization_id: orgId,
      status: 'actif',
      departure_date: { not: null, lte: today },
    },
    include: {
      accessRights: { where: { level: { not: 'none' } } },
    },
  });

  let processed = 0;
  for (const member of departed) {
    // Revoke all active access rights
    if (member.accessRights.length > 0) {
      await prisma.accessRight.updateMany({
        where: { member_id: member.id, level: { not: 'none' } },
        data: { level: 'none', notes: 'Révoqué automatiquement — date de départ atteinte' },
      });
    }

    // Set member status to inactif
    await prisma.member.update({
      where: { id: member.id },
      data: { status: 'inactif' },
    });

    // Resolve any open member_offboarding alert for this member
    await prisma.alert.updateMany({
      where: { organization_id: orgId, source_id: member.id, type: 'member_offboarding', is_resolved: false },
      data: { is_resolved: true, resolved_by: 'system', resolved_at: now.toISOString() },
    });

    // Audit trail
    await prisma.auditTrail.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        actor: 'system',
        action: 'member.offboarded',
        target_type: 'member',
        target_id: member.id,
        target_label: member.full_name,
        old_value: { status: 'actif', access_count: member.accessRights.length },
        new_value: { status: 'inactif', access_count: 0, reason: 'departure_date_reached' },
        ip_address: '127.0.0.1',
        user_agent: 'Tracix-Cron/1.0',
      },
    });

    processed++;
    console.log(`[Cron] Offboarded: ${member.full_name} (${member.accessRights.length} accès révoqués)`);
  }

  return processed;
}

async function checkCriticalAlertEmails(orgId: string, orgName: string): Promise<void> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Alertes non résolues créées aujourd'hui (critical ou warning)
  const newAlerts = await prisma.alert.findMany({
    where: {
      organization_id: orgId,
      is_resolved: false,
      severity: { in: ['critical', 'warning'] },
      created_at: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      },
    },
    orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
  });

  if (newAlerts.length === 0) return;

  // Anti-doublon : un seul digest par org par jour
  const alreadySent = await prisma.auditTrail.findFirst({
    where: {
      organization_id: orgId,
      action: 'email.alert_digest',
      created_at: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      },
    },
  });
  if (alreadySent) return;

  const admins = await prisma.userApp.findMany({
    where: { organization_id: orgId, role: { in: ['admin', 'manager'] } },
    select: { email: true },
  });
  const adminEmails = admins.map((a) => a.email);
  if (adminEmails.length === 0) return;

  await sendCriticalAlertsEmail({
    to: adminEmails,
    orgName,
    alerts: newAlerts.map((a) => ({
      type: a.type,
      severity: a.severity,
      message: a.message,
      source_label: a.source_label,
      source_module: a.source_module,
    })),
  });

  // Log anti-doublon
  await prisma.auditTrail.create({
    data: {
      id: `email_digest_${orgId}_${today}`,
      organization_id: orgId,
      actor: 'system',
      action: 'email.alert_digest',
      target_type: 'organization',
      target_id: orgId,
      target_label: orgName,
      old_value: {},
      new_value: { recipients: adminEmails, alert_count: newAlerts.length, date: today },
      ip_address: '127.0.0.1',
      user_agent: 'Tracix-Cron/1.0',
    },
  });
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
