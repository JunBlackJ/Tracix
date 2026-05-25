import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { sendAlertEmail } from './email.service';
import { config } from '../config';

interface AlertInput {
  id: string;
  organization_id: string;
  source_module: string;
  source_id: string;
  source_label: string;
  type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  resolved_by: string;
  resolved_at: string;
}

export async function generateAlerts(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return;

  const now = new Date();
  const newAlerts: AlertInput[] = [];

  // ─── 1. Members with departure_date passed and still active ───
  const departedActiveMembers = await prisma.member.findMany({
    where: {
      organization_id: orgId,
      status: 'actif',
      departure_date: { not: null },
    },
    include: {
      accessRights: {
        where: { level: { not: 'none' } },
      },
    },
  });

  for (const member of departedActiveMembers) {
    if (!member.departure_date) continue;
    const departureDate = new Date(member.departure_date);
    if (departureDate < now) {
      const activeAccessCount = member.accessRights.length;
      if (activeAccessCount > 0) {
        const existing = await prisma.alert.findFirst({
          where: {
            organization_id: orgId,
            source_id: member.id,
            type: 'member_offboarding',
            is_resolved: false,
          },
        });
        if (!existing) {
          newAlerts.push({
            id: uuidv4(),
            organization_id: orgId,
            source_module: 'habilitation',
            source_id: member.id,
            source_label: member.full_name,
            type: 'member_offboarding',
            severity: 'critical',
            message: `Date de départ (${member.departure_date}) passée — ${activeAccessCount} accès toujours actifs`,
            is_resolved: false,
            resolved_by: '',
            resolved_at: '',
          });
        }
      }
    }
  }

  // ─── 2. Platforms with admin_count > max_admin_per_platform ───
  const platforms = await prisma.platform.findMany({
    where: { organization_id: orgId },
    include: {
      accessRights: {
        where: { level: 'admin' },
        include: { member: { select: { full_name: true } } },
      },
    },
  });

  for (const platform of platforms) {
    const adminCount = platform.accessRights.length;
    if (adminCount > org.max_admin_per_platform) {
      const adminNames = platform.accessRights.map((ar) => ar.member.full_name).join(', ');
      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: platform.id,
          type: 'admin_count_high',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'habilitation',
          source_id: platform.id,
          source_label: platform.name,
          type: 'admin_count_high',
          severity: 'warning',
          message: `${adminCount} comptes Admin sur ${platform.name} (seuil: ${org.max_admin_per_platform}) : ${adminNames}`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    }
  }

  // ─── 3. Platforms without MFA that have admin accounts ───
  for (const platform of platforms) {
    if (!platform.has_mfa && platform.accessRights.length > 0) {
      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: platform.id,
          type: 'no_mfa_on_admin',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'habilitation',
          source_id: platform.id,
          source_label: platform.name,
          type: 'no_mfa_on_admin',
          severity: 'critical',
          message: `${platform.name} : ${platform.accessRights.length} comptes Admin sans MFA activé`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    }
  }

  // ─── 4. Access rights with last_review_date > access_review_delay_days ago ───
  const overdueThreshold = new Date(now.getTime() - org.access_review_delay_days * 24 * 60 * 60 * 1000);
  const overdueMembers = await prisma.member.findMany({
    where: { organization_id: orgId },
    include: {
      accessRights: true,
    },
  });

  for (const member of overdueMembers) {
    const overdueAccess = member.accessRights.filter((ar) => {
      if (!ar.last_review_date) return false;
      return new Date(ar.last_review_date) < overdueThreshold;
    });

    if (overdueAccess.length > 0) {
      const oldestReview = overdueAccess.reduce((oldest, ar) => {
        const d = new Date(ar.last_review_date);
        return d < oldest ? d : oldest;
      }, new Date());
      const daysSinceReview = Math.floor((now.getTime() - oldestReview.getTime()) / (1000 * 60 * 60 * 24));

      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: member.id,
          type: 'access_review_overdue',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'habilitation',
          source_id: member.id,
          source_label: member.full_name,
          type: 'access_review_overdue',
          severity: 'warning',
          message: `Dernière revue d'accès il y a ${daysSinceReview} jours (seuil: ${org.access_review_delay_days}j)`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    }
  }

  // ─── 5. Subscriptions expiring within subscription_alert_days ───
  const subscriptions = await prisma.subscription.findMany({
    where: { organization_id: orgId, status: 'actif' },
  });

  for (const sub of subscriptions) {
    if (!sub.renewal_date) continue;
    const renewalDate = new Date(sub.renewal_date);
    const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilRenewal >= 0 && daysUntilRenewal <= org.subscription_alert_days) {
      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: sub.id,
          type: 'subscription_expiring',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'abonnement',
          source_id: sub.id,
          source_label: sub.name,
          type: 'subscription_expiring',
          severity: 'warning',
          message: `Renouvellement dans ${daysUntilRenewal} jours (${sub.renewal_date})`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    } else if (daysUntilRenewal < 0) {
      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: sub.id,
          type: 'subscription_expired',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'abonnement',
          source_id: sub.id,
          source_label: sub.name,
          type: 'subscription_expired',
          severity: 'critical',
          message: `Abonnement ${sub.name} expiré depuis ${Math.abs(daysUntilRenewal)} jours`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    }
  }

  // ─── 6. Systems with end_of_support_date < 90 days away ───
  const systems = await prisma.system.findMany({
    where: { organization_id: orgId, status: { not: 'inactif' } },
  });

  for (const system of systems) {
    if (!system.end_of_support_date) continue;
    const eosDate = new Date(system.end_of_support_date);
    const daysUntilEos = Math.floor((eosDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilEos >= 0 && daysUntilEos <= 90) {
      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: system.id,
          type: 'system_end_of_support',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'système',
          source_id: system.id,
          source_label: system.hostname,
          type: 'system_end_of_support',
          severity: 'warning',
          message: `Fin de support ${system.os_version} dans ${daysUntilEos} jours (${system.end_of_support_date})`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    }
  }

  // ─── 7. Members with shared accounts that have admin access ───
  const sharedAccountMembers = await prisma.member.findMany({
    where: {
      organization_id: orgId,
      account_type: { in: ['partagé', 'service'] },
    },
    include: {
      accessRights: {
        where: { level: 'admin' },
        include: { platform: { select: { name: true } } },
      },
    },
  });

  for (const member of sharedAccountMembers) {
    if (member.accessRights.length > 0) {
      const platformNames = member.accessRights.map((ar) => ar.platform.name).join(', ');
      const existing = await prisma.alert.findFirst({
        where: {
          organization_id: orgId,
          source_id: member.id,
          type: 'shared_account_admin',
          is_resolved: false,
        },
      });
      if (!existing) {
        newAlerts.push({
          id: uuidv4(),
          organization_id: orgId,
          source_module: 'habilitation',
          source_id: member.id,
          source_label: member.full_name,
          type: 'shared_account_admin',
          severity: 'warning',
          message: `Compte ${member.account_type} avec droits Admin sur : ${platformNames}`,
          is_resolved: false,
          resolved_by: '',
          resolved_at: '',
        });
      }
    }
  }

  // ─── Resolve alerts that are no longer valid ───
  // admin_count_high : resolve if adminCount <= max_admin_per_platform
  for (const platform of platforms) {
    const adminCount = platform.accessRights.length;
    if (adminCount <= org.max_admin_per_platform) {
      await prisma.alert.updateMany({
        where: {
          organization_id: orgId,
          source_id: platform.id,
          type: 'admin_count_high',
          is_resolved: false,
        },
        data: { is_resolved: true, resolved_by: 'system', resolved_at: now.toISOString() },
      });
    }
  }

  // access_review_overdue : resolve if no access is overdue anymore
  for (const member of overdueMembers) {
    const overdueAccess = member.accessRights.filter((ar) => {
      if (!ar.last_review_date) return false;
      return new Date(ar.last_review_date) < overdueThreshold;
    });
    if (overdueAccess.length === 0) {
      await prisma.alert.updateMany({
        where: {
          organization_id: orgId,
          source_id: member.id,
          type: 'access_review_overdue',
          is_resolved: false,
        },
        data: { is_resolved: true, resolved_by: 'system', resolved_at: now.toISOString() },
      });
    }
  }

  // subscription_expiring : resolve if renewal is now beyond the threshold
  for (const sub of subscriptions) {
    if (!sub.renewal_date) continue;
    const renewalDate = new Date(sub.renewal_date);
    const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilRenewal > org.subscription_alert_days) {
      await prisma.alert.updateMany({
        where: {
          organization_id: orgId,
          source_id: sub.id,
          type: 'subscription_expiring',
          is_resolved: false,
        },
        data: { is_resolved: true, resolved_by: 'system', resolved_at: now.toISOString() },
      });
    }
  }

  // ─── Insert all new alerts ───
  if (newAlerts.length > 0) {
    await prisma.alert.createMany({ data: newAlerts });

    // Envoi immédiat si fréquence = "immediate" et email activé
    const orgPrefs = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { alert_email_enabled: true, alert_email_address: true, alert_email_frequency: true, name: true },
    });

    if (orgPrefs?.alert_email_enabled && orgPrefs.alert_email_address && orgPrefs.alert_email_frequency === 'immediate') {
      sendAlertEmail({
        to: orgPrefs.alert_email_address,
        orgName: orgPrefs.name,
        alerts: newAlerts.map((a) => ({
          type: a.type,
          severity: a.severity,
          message: a.message,
          source_label: a.source_label,
        })),
        frontendUrl: config.frontendUrl,
      }).catch((err) => console.error('[Email] Erreur envoi alertes immédiates:', err));
    }
  }
}
