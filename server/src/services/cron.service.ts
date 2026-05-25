import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { generateAlerts } from './alert.service';
import { takeRiskSnapshot } from './snapshot.service';
import { sendAlertEmail } from './email.service';
import { config } from '../config';

const CRON_LOCK_KEY = 1_337_420; // arbitrary stable integer for pg_try_advisory_lock

// Runs every day at 8:00 AM
export function startCronJobs(): void {
  cron.schedule('0 8 * * *', async () => {
    // Acquire a PostgreSQL advisory lock so only one instance runs this job at a time.
    const [lockRow] = await prisma.$queryRaw<[{ acquired: boolean }]>`
      SELECT pg_try_advisory_lock(${CRON_LOCK_KEY}) AS acquired
    `;
    if (!lockRow.acquired) {
      console.log('[Cron] Another instance is running — skipping.');
      return;
    }
    console.log('[Cron] Daily check starting…');
    try {
      const orgs = await prisma.organization.findMany();
      for (const org of orgs) {
        // Isoler chaque org — une erreur n'arrête pas les autres
        try { await processOffboarding(org.id); }
        catch (e) { console.error(`[Cron] processOffboarding failed for ${org.id}:`, e); }

        try { await generateAlerts(org.id); }
        catch (e) { console.error(`[Cron] generateAlerts failed for ${org.id}:`, e); }

        try { await takeRiskSnapshot(org.id); }
        catch (e) { console.error(`[Cron] takeRiskSnapshot failed for ${org.id}:`, e); }

        try { await checkSubscriptionEmails(org.id); }
        catch (e) { console.error(`[Cron] checkSubscriptionEmails failed for ${org.id}:`, e); }

        try { await checkCriticalAlertEmails(org.id, org.name); }
        catch (e) { console.error(`[Cron] checkCriticalAlertEmails failed for ${org.id}:`, e); }

        try { await checkPlanExpiryEmail(org.id, org.name); }
        catch (e) { console.error(`[Cron] checkPlanExpiryEmail failed for ${org.id}:`, e); }
      }

      // Data retention — run once globally (not per-org)
      try { await purgeOldData(); }
      catch (e) { console.error('[Cron] purgeOldData failed:', e); }

      console.log('[Cron] Daily check done.');
    } catch (e) {
      console.error('[Cron] Fatal error during daily check:', e);
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${CRON_LOCK_KEY})`;
    }
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

async function purgeOldData(): Promise<void> {
  const { auditTrailDays, refreshTokenDays, resolvedAlertsDays } = config.retention;
  const riskSnapshotDays = parseInt(process.env.RETENTION_RISK_SNAPSHOT_DAYS || '730', 10);
  const passwordResetHours = parseInt(process.env.RETENTION_PASSWORD_RESET_HOURS || '24', 10);
  const now = new Date();

  const auditCutoff    = new Date(now.getTime() - auditTrailDays * 24 * 60 * 60 * 1000);
  const refreshCutoff  = new Date(now.getTime() - refreshTokenDays * 24 * 60 * 60 * 1000);
  const alertsCutoff   = new Date(now.getTime() - resolvedAlertsDays * 24 * 60 * 60 * 1000);
  const snapshotCutoff = new Date(now.getTime() - riskSnapshotDays * 24 * 60 * 60 * 1000);
  const pwResetCutoff  = new Date(now.getTime() - passwordResetHours * 60 * 60 * 1000);

  const [auditCount, refreshCount, alertsCount, snapshotCount, pwResetCount] = await Promise.all([
    prisma.auditTrail.deleteMany({ where: { created_at: { lt: auditCutoff } } }),
    (prisma as any).refreshToken.deleteMany({
      where: { OR: [{ expires_at: { lt: refreshCutoff } }, { revoked: true, created_at: { lt: refreshCutoff } }] },
    }),
    prisma.alert.deleteMany({ where: { is_resolved: true, created_at: { lt: alertsCutoff } } }),
    prisma.riskSnapshot.deleteMany({ where: { created_at: { lt: snapshotCutoff } } }),
    (prisma as any).passwordResetToken.deleteMany({ where: { expires_at: { lt: pwResetCutoff } } }),
  ]);

  console.log(JSON.stringify({
    event: 'data_retention_purge',
    audit_trails_deleted: auditCount.count,
    refresh_tokens_deleted: refreshCount.count,
    resolved_alerts_deleted: alertsCount.count,
    risk_snapshots_deleted: snapshotCount.count,
    password_reset_tokens_deleted: pwResetCount.count,
    cutoffs: {
      audit_trail: auditCutoff.toISOString(),
      refresh_token: refreshCutoff.toISOString(),
      resolved_alerts: alertsCutoff.toISOString(),
      risk_snapshots: snapshotCutoff.toISOString(),
      password_reset_tokens: pwResetCutoff.toISOString(),
    },
  }));
}

async function checkPlanExpiryEmail(orgId: string, orgName: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, plan_expires_at: true, alert_email_address: true, alert_email_enabled: true },
  });

  if (!org || org.plan === 'free' || !org.plan_expires_at) return;
  if (!org.alert_email_enabled || !org.alert_email_address) return;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const daysLeft = Math.floor((org.plan_expires_at.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const notifyAt = [7, 1];
  if (!notifyAt.includes(daysLeft)) return;

  const alreadySent = await prisma.auditTrail.findFirst({
    where: {
      organization_id: orgId,
      action: 'email.plan_expiry',
      target_label: String(daysLeft),
      created_at: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    },
  });
  if (alreadySent) return;

  const planLabel = org.plan === 'enterprise' ? 'Enterprise' : 'Pro';

  await sendAlertEmail({
    to: org.alert_email_address,
    orgName,
    alerts: [{
      type: 'subscription_expiring',
      severity: daysLeft <= 1 ? 'critical' : 'warning',
      message: `Votre plan Tracix ${planLabel} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${org.plan_expires_at.toISOString().split('T')[0]}). Renouvelez pour conserver l'accès à toutes vos fonctionnalités.`,
      source_label: `Plan Tracix ${planLabel}`,
    }],
    frontendUrl: config.frontendUrl,
  });

  await prisma.auditTrail.create({
    data: {
      id: `email_plan_${orgId}_${daysLeft}_${today}`,
      organization_id: orgId,
      actor: 'system',
      action: 'email.plan_expiry',
      target_type: 'organization',
      target_id: orgId,
      target_label: String(daysLeft),
      old_value: {},
      new_value: { recipient: org.alert_email_address, days_left: daysLeft, plan: org.plan },
      ip_address: '127.0.0.1',
      user_agent: 'Tracix-Cron/1.0',
    },
  });

  console.log(`[Cron] Plan expiry email sent for ${orgName} (${daysLeft}j) → ${org.alert_email_address}`);
}
