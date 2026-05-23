import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { generateAlerts } from './alert.service';
import { sendAlertEmail } from './email.service';
import { config } from '../config';

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

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { alert_email_enabled: true, alert_email_address: true, alert_email_frequency: true },
  });

  // Digest quotidien uniquement si activé et fréquence = daily
  if (!org?.alert_email_enabled || !org.alert_email_address || org.alert_email_frequency !== 'daily') return;

  const newAlerts = await prisma.alert.findMany({
    where: {
      organization_id: orgId,
      is_resolved: false,
      severity: { in: ['critical', 'warning'] },
      created_at: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    },
    orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
  });

  if (newAlerts.length === 0) return;

  // Anti-doublon : un seul digest par org par jour
  const alreadySent = await prisma.auditTrail.findFirst({
    where: {
      organization_id: orgId,
      action: 'email.alert_digest',
      created_at: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    },
  });
  if (alreadySent) return;

  await sendAlertEmail({
    to: org.alert_email_address,
    orgName,
    alerts: newAlerts.map((a) => ({
      type: a.type,
      severity: a.severity,
      message: a.message,
      source_label: a.source_label,
    })),
    frontendUrl: config.frontendUrl,
  });

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
      new_value: { recipient: org.alert_email_address, alert_count: newAlerts.length, date: today },
      ip_address: '127.0.0.1',
      user_agent: 'Tracix-Cron/1.0',
    },
  });
}

async function checkSubscriptionEmails(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return;
  if (!org.alert_email_enabled || !org.alert_email_address) return;

  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: { organization_id: orgId, status: 'actif' },
  });

  for (const sub of subscriptions) {
    if (!sub.renewal_date) continue;

    const renewalDate = new Date(sub.renewal_date);
    const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const notifyAt = [30, 14, 7, 1];
    if (!notifyAt.includes(daysUntilRenewal)) continue;

    const alreadySent = await prisma.auditTrail.findFirst({
      where: {
        organization_id: orgId,
        action: 'email.subscription_alert',
        target_id: sub.id,
        target_label: String(daysUntilRenewal),
        created_at: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
    });
    if (alreadySent) continue;

    await sendAlertEmail({
      to: org.alert_email_address,
      orgName: org.name,
      alerts: [{
        type: 'subscription_expiring',
        severity: daysUntilRenewal <= 7 ? 'critical' : 'warning',
        message: `Renouvellement dans ${daysUntilRenewal} jour${daysUntilRenewal > 1 ? 's' : ''} (${sub.renewal_date}) — ${sub.vendor}`,
        source_label: sub.name,
      }],
      frontendUrl: config.frontendUrl,
    });

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
        new_value: { recipient: org.alert_email_address, days_remaining: daysUntilRenewal },
        ip_address: '127.0.0.1',
        user_agent: 'Tracix-Cron/1.0',
      },
    });
  }
}
