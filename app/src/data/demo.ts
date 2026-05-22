// ═══════════════════════════════════════════
// Données démo — Smartwave Technologies
// ═══════════════════════════════════════════

import type {
  Organization, UserApp, Platform, Member, AccessRight,
  System, NetworkFlow, Subscription, Alert, AuditTrail,
  AccessLevel, RiskFactor, MemberStatus,
} from '@/types';

export const DEMO_ORG: Organization = {
  id: 'org_smartwave',
  name: 'Smartwave Technologies',
  logo_url: '',
  plan: 'pro',
  max_admin_per_platform: 3,
  access_review_delay_days: 90,
  subscription_alert_days: 30,
  created_at: '2024-01-15T08:30:00Z',
};

export const DEMO_USER: UserApp = {
  id: 'user_admin_colombe',
  organization_id: 'org_smartwave',
  full_name: 'Colombe D.',
  email: 'colombe@smartwave.io',
  role: 'admin',
  last_login_at: '2026-05-21T09:15:00Z',
  created_at: '2024-01-15T08:30:00Z',
};

export const PLATFORMS: Platform[] = [
  {
    id: 'plat_cyberpanel',
    organization_id: 'org_smartwave',
    name: 'CyberPanel',
    category: 'Administration',
    access_type: 'Interface Web',
    url: 'https://cp.smartwave.io:8090',
    auth_method: 'Mot de passe',
    has_mfa: false,
    environment: 'production',
    responsible: 'Roland A.',
    target_population: 'Admins système',
    sla: '99.9%',
    status: 'actif',
    last_check_date: '2026-05-10',
    notes: 'Panel principal — accès critique',
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2026-05-10T14:00:00Z',
  },
  {
    id: 'plat_github',
    organization_id: 'org_smartwave',
    name: 'GitHub',
    category: 'Dev',
    access_type: 'Interface Web',
    url: 'https://github.com/smartwavetech',
    auth_method: 'MFA + Mot de passe',
    has_mfa: true,
    environment: 'production',
    responsible: 'Kader K.',
    target_population: 'Équipe dev',
    sla: '99.9%',
    status: 'actif',
    last_check_date: '2026-05-18',
    notes: 'Repos privés + actions CI/CD',
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2026-05-18T09:00:00Z',
  },
  {
    id: 'plat_mailjet',
    organization_id: 'org_smartwave',
    name: 'Mailjet',
    category: 'Notification',
    access_type: 'Interface Web',
    url: 'https://app.mailjet.com',
    auth_method: 'MFA + Mot de passe',
    has_mfa: true,
    environment: 'production',
    responsible: 'Fabrice D.',
    target_population: 'Toute l\'équipe',
    sla: '99.5%',
    status: 'actif',
    last_check_date: '2026-05-15',
    notes: 'Emails transactionnels + marketing',
    created_at: '2024-03-01T10:00:00Z',
    updated_at: '2026-05-15T11:00:00Z',
  },
  {
    id: 'plat_cloudflare',
    organization_id: 'org_smartwave',
    name: 'Cloudflare',
    category: 'Cloud',
    access_type: 'Interface Web',
    url: 'https://dash.cloudflare.com',
    auth_method: 'MFA + Mot de passe',
    has_mfa: true,
    environment: 'production',
    responsible: 'Roland A.',
    target_population: 'Admins infra',
    sla: '99.99%',
    status: 'actif',
    last_check_date: '2026-05-19',
    notes: 'DNS + WAF + CDN',
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2026-05-19T16:30:00Z',
  },
  {
    id: 'plat_vpsssh',
    organization_id: 'org_smartwave',
    name: 'VPS SSH',
    category: 'Administration',
    access_type: 'CLI',
    url: 'ssh://vps-prod.smartwave.io',
    auth_method: 'Clés SSH',
    has_mfa: false,
    environment: 'production',
    responsible: 'Roland A.',
    target_population: 'Admins système',
    sla: '99.9%',
    status: 'actif',
    last_check_date: '2026-05-05',
    notes: 'Accès root partagé — compte service',
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2026-05-05T10:00:00Z',
  },
];

// Helper pour calculer le risk score d'un membre
function computeRiskFactors(
  _memberId: string,
  _name: string,
  _accessCount: number,
  adminCount: number,
  lastReviewDays: number,
  isShared: boolean,
  departureDate: string | null,
  status: MemberStatus
): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (adminCount > 3) {
    factors.push({ label: `${adminCount} plateformes en Admin (max 3)`, delta: 30 });
  }
  if (lastReviewDays > 90) {
    factors.push({ label: `Dernière revue il y a ${lastReviewDays} jours`, delta: 25 });
  }
  if (departureDate && new Date(departureDate) < new Date() && status === 'actif') {
    factors.push({ label: 'Date de départ passée, accès encore actifs', delta: 40 });
  }
  if (isShared && adminCount > 0) {
    factors.push({ label: 'Compte partagé avec droits Admin', delta: 20 });
  } else if (isShared) {
    factors.push({ label: 'Compte partagé', delta: 10 });
  }
  if (adminCount <= 2 && lastReviewDays <= 90 && !departureDate && !isShared) {
    factors.push({ label: 'Toutes les revues sont à jour', delta: -20 });
  }

  return factors;
}

function computeScore(factors: RiskFactor[]): number {
  const raw = factors.reduce((sum, f) => sum + f.delta, 50);
  return Math.max(0, Math.min(100, raw));
}

const now = new Date('2026-05-21');

export const MEMBERS: Member[] = [
  {
    id: 'mem_colombe',
    organization_id: 'org_smartwave',
    full_name: 'Colombe D.',
    username: 'colombe.d',
    team: 'Sécurité',
    account_type: 'privilégié',
    status: 'actif',
    email: 'colombe@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: 'Lead sécurité — accès étendus justifiés',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2026-05-20T10:00:00Z',
  },
  {
    id: 'mem_roland',
    organization_id: 'org_smartwave',
    full_name: 'Roland A.',
    username: 'roland.a',
    team: 'Sécurité',
    account_type: 'privilégié',
    status: 'actif',
    email: 'roland@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: 'Admin infra — gère les VPS et Cloudflare',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2026-05-18T14:00:00Z',
  },
  {
    id: 'mem_fabrice',
    organization_id: 'org_smartwave',
    full_name: 'Fabrice D.',
    username: 'fabrice.d',
    team: 'Sécurité',
    account_type: 'privilégié',
    status: 'actif',
    email: 'fabrice@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: '',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2026-05-15T11:00:00Z',
  },
  {
    id: 'mem_kader',
    organization_id: 'org_smartwave',
    full_name: 'Kader K.',
    username: 'kader.k',
    team: 'Devs_mobile',
    account_type: 'nominatif',
    status: 'actif',
    email: 'kader@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: '',
    created_at: '2024-03-01T08:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'mem_yoro',
    organization_id: 'org_smartwave',
    full_name: 'Yoro M.',
    username: 'yoro.m',
    team: 'Devs_mobile',
    account_type: 'nominatif',
    status: 'actif',
    email: 'yoro@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: '',
    created_at: '2024-03-01T08:00:00Z',
    updated_at: '2026-04-10T09:00:00Z',
  },
  {
    id: 'mem_david',
    organization_id: 'org_smartwave',
    full_name: 'David A.',
    username: 'david.a',
    team: 'Devs_mobile',
    account_type: 'nominatif',
    status: 'actif',
    email: 'david@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: 'Stage de fin d\'études — CDI envisagé',
    created_at: '2025-09-01T08:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
  },
  {
    id: 'mem_enoch',
    organization_id: 'org_smartwave',
    full_name: 'Enoch D.',
    username: 'enoch.d',
    team: 'Non-Tech',
    account_type: 'nominatif',
    status: 'actif',
    email: 'enoch@smartwave.io',
    departure_date: null,
    risk_score: 0,
    risk_factors: [],
    notes: '',
    created_at: '2024-06-01T08:00:00Z',
    updated_at: '2026-03-20T11:00:00Z',
  },
  {
    id: 'mem_elodie',
    organization_id: 'org_smartwave',
    full_name: 'Elodie T.',
    username: 'elodie.t',
    team: 'Non-Tech',
    account_type: 'nominatif',
    status: 'actif',
    email: 'elodie@smartwave.io',
    departure_date: '2026-05-20',
    risk_score: 0,
    risk_factors: [],
    notes: 'Départ annoncé — offboarding à finaliser',
    created_at: '2024-06-01T08:00:00Z',
    updated_at: '2026-05-20T09:00:00Z',
  },
];

// ─── Matrice d'accès 8×5 ───
export const ACCESS_RIGHTS: AccessRight[] = [
  // Colombe — Admin sur tout
  { id: 'ar_c1', organization_id: 'org_smartwave', member_id: 'mem_colombe', platform_id: 'plat_cyberpanel', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-04-15', next_review_date: '2026-07-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_c2', organization_id: 'org_smartwave', member_id: 'mem_colombe', platform_id: 'plat_github', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-04-15', next_review_date: '2026-07-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_c3', organization_id: 'org_smartwave', member_id: 'mem_colombe', platform_id: 'plat_mailjet', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-04-15', next_review_date: '2026-07-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_c4', organization_id: 'org_smartwave', member_id: 'mem_colombe', platform_id: 'plat_cloudflare', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-04-15', next_review_date: '2026-07-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_c5', organization_id: 'org_smartwave', member_id: 'mem_colombe', platform_id: 'plat_vpsssh', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-04-15', next_review_date: '2026-07-15', reviewed_by: 'Roland A.', notes: '' },

  // Roland — Admin sur CyberPanel + VPS SSH + Cloudflare
  { id: 'ar_r1', organization_id: 'org_smartwave', member_id: 'mem_roland', platform_id: 'plat_cyberpanel', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-05-10', next_review_date: '2026-08-10', reviewed_by: 'Colombe D.', notes: '' },
  { id: 'ar_r2', organization_id: 'org_smartwave', member_id: 'mem_roland', platform_id: 'plat_github', level: 'ro', granted_at: '2024-03-01', granted_by: 'Kader K.', last_review_date: '2026-03-01', next_review_date: '2026-06-01', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_r3', organization_id: 'org_smartwave', member_id: 'mem_roland', platform_id: 'plat_mailjet', level: 'rw', granted_at: '2024-02-15', granted_by: 'Fabrice D.', last_review_date: '2026-04-01', next_review_date: '2026-07-01', reviewed_by: 'Fabrice D.', notes: '' },
  { id: 'ar_r4', organization_id: 'org_smartwave', member_id: 'mem_roland', platform_id: 'plat_cloudflare', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-05-18', next_review_date: '2026-08-18', reviewed_by: 'Colombe D.', notes: '' },
  { id: 'ar_r5', organization_id: 'org_smartwave', member_id: 'mem_roland', platform_id: 'plat_vpsssh', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-04-20', next_review_date: '2026-07-20', reviewed_by: 'Colombe D.', notes: 'Compte root partagé' },

  // Fabrice — Admin sur Mailjet + Cloudflare
  { id: 'ar_f1', organization_id: 'org_smartwave', member_id: 'mem_fabrice', platform_id: 'plat_cyberpanel', level: 'ro', granted_at: '2024-02-01', granted_by: 'Roland A.', last_review_date: '2026-03-15', next_review_date: '2026-06-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_f2', organization_id: 'org_smartwave', member_id: 'mem_fabrice', platform_id: 'plat_github', level: 'ro', granted_at: '2024-03-01', granted_by: 'Kader K.', last_review_date: '2026-02-20', next_review_date: '2026-05-20', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_f3', organization_id: 'org_smartwave', member_id: 'mem_fabrice', platform_id: 'plat_mailjet', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-05-15', next_review_date: '2026-08-15', reviewed_by: 'Colombe D.', notes: '' },
  { id: 'ar_f4', organization_id: 'org_smartwave', member_id: 'mem_fabrice', platform_id: 'plat_cloudflare', level: 'admin', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2026-05-12', next_review_date: '2026-08-12', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_f5', organization_id: 'org_smartwave', member_id: 'mem_fabrice', platform_id: 'plat_vpsssh', level: 'none', granted_at: '2024-01-20', granted_by: 'System', last_review_date: '2024-01-20', next_review_date: '2024-04-20', reviewed_by: 'System', notes: 'Non nécessaire' },

  // Kader — Admin CyberPanel, RW GitHub + Mailjet
  { id: 'ar_k1', organization_id: 'org_smartwave', member_id: 'mem_kader', platform_id: 'plat_cyberpanel', level: 'admin', granted_at: '2024-03-01', granted_by: 'Roland A.', last_review_date: '2026-02-15', next_review_date: '2026-05-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_k2', organization_id: 'org_smartwave', member_id: 'mem_kader', platform_id: 'plat_github', level: 'rw', granted_at: '2024-03-01', granted_by: 'Kader K.', last_review_date: '2026-02-15', next_review_date: '2026-05-15', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_k3', organization_id: 'org_smartwave', member_id: 'mem_kader', platform_id: 'plat_mailjet', level: 'rw', granted_at: '2024-03-15', granted_by: 'Fabrice D.', last_review_date: '2026-02-15', next_review_date: '2026-05-15', reviewed_by: 'Fabrice D.', notes: '' },
  { id: 'ar_k4', organization_id: 'org_smartwave', member_id: 'mem_kader', platform_id: 'plat_cloudflare', level: 'ro', granted_at: '2024-04-01', granted_by: 'Roland A.', last_review_date: '2025-11-01', next_review_date: '2026-02-01', reviewed_by: 'Roland A.', notes: 'Revue dépassée' },
  { id: 'ar_k5', organization_id: 'org_smartwave', member_id: 'mem_kader', platform_id: 'plat_vpsssh', level: 'none', granted_at: '2024-03-01', granted_by: 'Roland A.', last_review_date: '2024-03-01', next_review_date: '2024-06-01', reviewed_by: 'Roland A.', notes: '' },

  // Yoro — Admin CyberPanel, RW GitHub
  { id: 'ar_y1', organization_id: 'org_smartwave', member_id: 'mem_yoro', platform_id: 'plat_cyberpanel', level: 'admin', granted_at: '2024-03-01', granted_by: 'Roland A.', last_review_date: '2026-04-10', next_review_date: '2026-07-10', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_y2', organization_id: 'org_smartwave', member_id: 'mem_yoro', platform_id: 'plat_github', level: 'rw', granted_at: '2024-03-01', granted_by: 'Kader K.', last_review_date: '2026-04-10', next_review_date: '2026-07-10', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_y3', organization_id: 'org_smartwave', member_id: 'mem_yoro', platform_id: 'plat_mailjet', level: 'none', granted_at: '2024-03-01', granted_by: 'Fabrice D.', last_review_date: '2024-03-01', next_review_date: '2024-06-01', reviewed_by: 'Fabrice D.', notes: '' },
  { id: 'ar_y4', organization_id: 'org_smartwave', member_id: 'mem_yoro', platform_id: 'plat_cloudflare', level: 'ro', granted_at: '2024-04-01', granted_by: 'Roland A.', last_review_date: '2026-01-15', next_review_date: '2026-04-15', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_y5', organization_id: 'org_smartwave', member_id: 'mem_yoro', platform_id: 'plat_vpsssh', level: 'none', granted_at: '2024-03-01', granted_by: 'Roland A.', last_review_date: '2024-03-01', next_review_date: '2024-06-01', reviewed_by: 'Roland A.', notes: '' },

  // David — Admin CyberPanel, RW GitHub
  { id: 'ar_d1', organization_id: 'org_smartwave', member_id: 'mem_david', platform_id: 'plat_cyberpanel', level: 'admin', granted_at: '2025-09-15', granted_by: 'Roland A.', last_review_date: '2026-05-01', next_review_date: '2026-08-01', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_d2', organization_id: 'org_smartwave', member_id: 'mem_david', platform_id: 'plat_github', level: 'rw', granted_at: '2025-09-15', granted_by: 'Kader K.', last_review_date: '2026-05-01', next_review_date: '2026-08-01', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_d3', organization_id: 'org_smartwave', member_id: 'mem_david', platform_id: 'plat_mailjet', level: 'none', granted_at: '2025-09-15', granted_by: 'Fabrice D.', last_review_date: '2025-09-15', next_review_date: '2025-12-15', reviewed_by: 'Fabrice D.', notes: '' },
  { id: 'ar_d4', organization_id: 'org_smartwave', member_id: 'mem_david', platform_id: 'plat_cloudflare', level: 'ro', granted_at: '2025-10-01', granted_by: 'Roland A.', last_review_date: '2026-02-01', next_review_date: '2026-05-01', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_d5', organization_id: 'org_smartwave', member_id: 'mem_david', platform_id: 'plat_vpsssh', level: 'none', granted_at: '2025-09-15', granted_by: 'Roland A.', last_review_date: '2025-09-15', next_review_date: '2025-12-15', reviewed_by: 'Roland A.', notes: '' },

  // Enoch — RO sur Mailjet seulement
  { id: 'ar_e1', organization_id: 'org_smartwave', member_id: 'mem_enoch', platform_id: 'plat_cyberpanel', level: 'none', granted_at: '2024-06-01', granted_by: 'Roland A.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_e2', organization_id: 'org_smartwave', member_id: 'mem_enoch', platform_id: 'plat_github', level: 'none', granted_at: '2024-06-01', granted_by: 'Kader K.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_e3', organization_id: 'org_smartwave', member_id: 'mem_enoch', platform_id: 'plat_mailjet', level: 'ro', granted_at: '2024-06-15', granted_by: 'Fabrice D.', last_review_date: '2026-03-20', next_review_date: '2026-06-20', reviewed_by: 'Fabrice D.', notes: 'Consultation stats email' },
  { id: 'ar_e4', organization_id: 'org_smartwave', member_id: 'mem_enoch', platform_id: 'plat_cloudflare', level: 'none', granted_at: '2024-06-01', granted_by: 'Roland A.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_e5', organization_id: 'org_smartwave', member_id: 'mem_enoch', platform_id: 'plat_vpsssh', level: 'none', granted_at: '2024-06-01', granted_by: 'Roland A.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Roland A.', notes: '' },

  // Elodie — RO sur Mailjet seulement
  { id: 'ar_el1', organization_id: 'org_smartwave', member_id: 'mem_elodie', platform_id: 'plat_cyberpanel', level: 'none', granted_at: '2024-06-01', granted_by: 'Roland A.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_el2', organization_id: 'org_smartwave', member_id: 'mem_elodie', platform_id: 'plat_github', level: 'none', granted_at: '2024-06-01', granted_by: 'Kader K.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Kader K.', notes: '' },
  { id: 'ar_el3', organization_id: 'org_smartwave', member_id: 'mem_elodie', platform_id: 'plat_mailjet', level: 'ro', granted_at: '2024-06-15', granted_by: 'Fabrice D.', last_review_date: '2026-03-20', next_review_date: '2026-06-20', reviewed_by: 'Fabrice D.', notes: 'Consultation stats email' },
  { id: 'ar_el4', organization_id: 'org_smartwave', member_id: 'mem_elodie', platform_id: 'plat_cloudflare', level: 'none', granted_at: '2024-06-01', granted_by: 'Roland A.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Roland A.', notes: '' },
  { id: 'ar_el5', organization_id: 'org_smartwave', member_id: 'mem_elodie', platform_id: 'plat_vpsssh', level: 'none', granted_at: '2024-06-01', granted_by: 'Roland A.', last_review_date: '2024-06-01', next_review_date: '2024-09-01', reviewed_by: 'Roland A.', notes: '' },
];

// ─── Calcul des risk scores ───
MEMBERS.forEach((m) => {
  const memberAccess = ACCESS_RIGHTS.filter((a) => a.member_id === m.id);
  const adminCount = memberAccess.filter((a) => a.level === 'admin').length;
  const lastReviewDays = memberAccess.length > 0
    ? Math.floor((now.getTime() - new Date(memberAccess[0].last_review_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isShared = m.account_type === 'partagé' || m.account_type === 'service';

  m.risk_factors = computeRiskFactors(m.id, m.full_name, memberAccess.length, adminCount, lastReviewDays, isShared, m.departure_date, m.status);
  m.risk_score = computeScore(m.risk_factors);
});

export const SYSTEMS: System[] = [
  {
    id: 'sys_vps_prod',
    organization_id: 'org_smartwave',
    system_id: 'SYS-001',
    hostname: 'vps-prod.smartwave.io',
    type: 'VPS',
    environment: 'production',
    os_version: 'AlmaLinux 9.4',
    ip_address: '192.168.10.10',
    vlan: 'VLAN-PROD',
    location: 'OVH Gravelines',
    role_usage: 'Hébergement principal',
    owner: 'Roland A.',
    tech_responsible: 'Roland A.',
    criticality: 'critique',
    status: 'actif',
    deployment_date: '2024-01-20',
    end_of_support_date: '2026-07-20',
    backup_policy: 'Quotidien 3h00, rétention 30j',
    last_patch_date: '2026-04-15',
    notes: 'Fin de support OS dans 60 jours — migration prévue AlmaLinux 9.5',
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2026-04-15T08:00:00Z',
  },
  {
    id: 'sys_vm_staging',
    organization_id: 'org_smartwave',
    system_id: 'SYS-002',
    hostname: 'vm-staging.smartwave.io',
    type: 'VM',
    environment: 'staging',
    os_version: 'Ubuntu 22.04 LTS',
    ip_address: '192.168.20.15',
    vlan: 'VLAN-STAGING',
    location: 'OVH Gravelines',
    role_usage: 'Environnement de test',
    owner: 'Kader K.',
    tech_responsible: 'Roland A.',
    criticality: 'normale',
    status: 'actif',
    deployment_date: '2024-03-01',
    end_of_support_date: '2027-04-01',
    backup_policy: 'Hebdomadaire',
    last_patch_date: '2026-05-10',
    notes: '',
    created_at: '2024-03-01T10:00:00Z',
    updated_at: '2026-05-10T10:00:00Z',
  },
];

export const NETWORK_FLOWS: NetworkFlow[] = [
  {
    id: 'fl_001', organization_id: 'org_smartwave', flow_id: 'FLX-VPS-001',
    source_host: '0.0.0.0/0', source_zone: 'WAN',
    destination_host: 'vps-prod.smartwave.io', destination_zone: 'DMZ-PROD',
    port: '80/443', protocol: 'TCP', service: 'HTTPS',
    direction: 'entrant', status: 'autorisé',
    firewall_rule: 'ALLOW-WEB-001', justification: 'Application web publique',
    responsible: 'Roland A.', last_review_date: '2025-11-20',
    created_at: '2024-01-20T10:00:00Z', updated_at: '2025-11-20T14:00:00Z',
  },
  {
    id: 'fl_002', organization_id: 'org_smartwave', flow_id: 'FLX-VPS-002',
    source_host: '192.168.10.0/24', source_zone: 'DMZ-PROD',
    destination_host: 'vps-prod.smartwave.io', destination_zone: 'DMZ-PROD',
    port: '22', protocol: 'TCP', service: 'SSH',
    direction: 'entrant', status: 'autorisé',
    firewall_rule: 'ALLOW-SSH-ADMIN', justification: 'Admin système',
    responsible: 'Roland A.', last_review_date: '2026-01-15',
    created_at: '2024-01-20T10:00:00Z', updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'fl_003', organization_id: 'org_smartwave', flow_id: 'FLX-VPS-003',
    source_host: 'vps-prod.smartwave.io', source_zone: 'DMZ-PROD',
    destination_host: 'smtp.mailjet.com', destination_zone: 'WAN',
    port: '587', protocol: 'TCP', service: 'SMTP',
    direction: 'sortant', status: 'autorisé',
    firewall_rule: 'ALLOW-SMTP-OUT', justification: 'Emails transactionnels',
    responsible: 'Fabrice D.', last_review_date: '2026-02-10',
    created_at: '2024-02-01T10:00:00Z', updated_at: '2026-02-10T11:00:00Z',
  },
  {
    id: 'fl_004', organization_id: 'org_smartwave', flow_id: 'FLX-VPS-004',
    source_host: 'vps-prod.smartwave.io', source_zone: 'DMZ-PROD',
    destination_host: '1.1.1.1', destination_zone: 'WAN',
    port: '53', protocol: 'UDP', service: 'DNS',
    direction: 'sortant', status: 'autorisé',
    firewall_rule: 'ALLOW-DNS-OUT', justification: 'Résolution DNS',
    responsible: 'Roland A.', last_review_date: '2025-12-01',
    created_at: '2024-01-20T10:00:00Z', updated_at: '2025-12-01T10:00:00Z',
  },
  {
    id: 'fl_005', organization_id: 'org_smartwave', flow_id: 'FLX-VPS-005',
    source_host: 'vps-prod.smartwave.io', source_zone: 'DMZ-PROD',
    destination_host: 'backup.ovh.net', destination_zone: 'WAN',
    port: '443', protocol: 'TCP', service: 'HTTPS',
    direction: 'sortant', status: 'autorisé',
    firewall_rule: 'ALLOW-BACKUP-OUT', justification: 'Sauvegardes cloud',
    responsible: 'Roland A.', last_review_date: '2026-03-15',
    created_at: '2024-01-20T10:00:00Z', updated_at: '2026-03-15T08:00:00Z',
  },
];

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub_github', organization_id: 'org_smartwave',
    name: 'GitHub Pro', category: 'Développement', vendor: 'GitHub',
    cost_monthly: 21, cost_annual: 252, currency: 'USD',
    billing_cycle: 'annuel', renewal_date: '2026-06-05',
    auto_renew: true, responsible: 'Kader K.', status: 'actif',
    contract_url: '', notes: '5 collaborateurs',
    created_at: '2024-01-15T10:00:00Z', updated_at: '2025-06-05T10:00:00Z',
  },
  {
    id: 'sub_mailjet', organization_id: 'org_smartwave',
    name: 'Mailjet Premium', category: 'Communication', vendor: 'Mailjet',
    cost_monthly: 35, cost_annual: 420, currency: 'EUR',
    billing_cycle: 'mensuel', renewal_date: '2026-07-20',
    auto_renew: true, responsible: 'Fabrice D.', status: 'actif',
    contract_url: '', notes: '150k emails/mois',
    created_at: '2024-02-01T10:00:00Z', updated_at: '2026-05-01T10:00:00Z',
  },
  {
    id: 'sub_cloudflare', organization_id: 'org_smartwave',
    name: 'Cloudflare Pro', category: 'Infrastructure', vendor: 'Cloudflare',
    cost_monthly: 20, cost_annual: 240, currency: 'USD',
    billing_cycle: 'annuel', renewal_date: '2026-05-29',
    auto_renew: true, responsible: 'Roland A.', status: 'actif',
    contract_url: '', notes: 'WAF + CDN pro',
    created_at: '2024-01-15T10:00:00Z', updated_at: '2025-05-29T10:00:00Z',
  },
];

export const ALERTS: Alert[] = [
  {
    id: 'alert_001', organization_id: 'org_smartwave',
    source_module: 'habilitation', source_id: 'mem_elodie', source_label: 'Elodie T.',
    type: 'member_offboarding', severity: 'critical',
    message: 'Date de départ (20/05/2026) passée — accès Mailjet toujours actifs',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-21T06:00:00Z',
  },
  {
    id: 'alert_002', organization_id: 'org_smartwave',
    source_module: 'habilitation', source_id: 'plat_cyberpanel', source_label: 'CyberPanel',
    type: 'admin_count_high', severity: 'warning',
    message: '5 comptes Admin sur CyberPanel (seuil: 3) : Colombe D., Roland A., Kader K., Yoro M., David A.',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-20T07:00:00Z',
  },
  {
    id: 'alert_003', organization_id: 'org_smartwave',
    source_module: 'habilitation', source_id: 'plat_cyberpanel', source_label: 'CyberPanel',
    type: 'no_mfa_on_admin', severity: 'critical',
    message: 'CyberPanel : 5 comptes Admin sans MFA activé',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-20T07:00:00Z',
  },
  {
    id: 'alert_004', organization_id: 'org_smartwave',
    source_module: 'habilitation', source_id: 'plat_vpsssh', source_label: 'VPS SSH',
    type: 'no_mfa_on_admin', severity: 'critical',
    message: 'VPS SSH : accès Admin par clés SSH uniquement — pas de MFA secondaire',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-20T07:00:00Z',
  },
  {
    id: 'alert_005', organization_id: 'org_smartwave',
    source_module: 'habilitation', source_id: 'mem_kader', source_label: 'Kader K.',
    type: 'access_review_overdue', severity: 'warning',
    message: 'Dernière revue d\'accès il y a 95 jours (seuil: 90j)',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-19T07:00:00Z',
  },
  {
    id: 'alert_006', organization_id: 'org_smartwave',
    source_module: 'habilitation', source_id: 'mem_roland', source_label: 'Roland A.',
    type: 'shared_account_admin', severity: 'warning',
    message: 'Compte root partagé sur VPS SSH avec droits Admin',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-18T07:00:00Z',
  },
  {
    id: 'alert_007', organization_id: 'org_smartwave',
    source_module: 'abonnement', source_id: 'sub_cloudflare', source_label: 'Cloudflare Pro',
    type: 'subscription_expiring', severity: 'warning',
    message: 'Renouvellement dans 8 jours (29/05/2026)',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-21T06:00:00Z',
  },
  {
    id: 'alert_008', organization_id: 'org_smartwave',
    source_module: 'abonnement', source_id: 'sub_github', source_label: 'GitHub Pro',
    type: 'subscription_expiring', severity: 'warning',
    message: 'Renouvellement dans 15 jours (05/06/2026)',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-21T06:00:00Z',
  },
  {
    id: 'alert_009', organization_id: 'org_smartwave',
    source_module: 'système', source_id: 'sys_vps_prod', source_label: 'VPS Production',
    type: 'system_end_of_support', severity: 'warning',
    message: 'Fin de support AlmaLinux 9.4 dans 60 jours (20/07/2026)',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-21T06:00:00Z',
  },
  {
    id: 'alert_010', organization_id: 'org_smartwave',
    source_module: 'système', source_id: 'sys_vps_prod', source_label: 'VPS Production',
    type: 'system_not_patched', severity: 'warning',
    message: 'Dernier patch de sécurité il y a 36 jours',
    is_resolved: false, resolved_by: '', resolved_at: '',
    created_at: '2026-05-21T06:00:00Z',
  },
];

export const AUDIT_TRAIL: AuditTrail[] = [
  {
    id: 'at_001', organization_id: 'org_smartwave',
    actor: 'colombe@smartwave.io', action: 'alert.reviewed',
    target_type: 'alert', target_id: 'alert_003', target_label: 'Alerte MFA CyberPanel',
    old_value: { is_resolved: false }, new_value: { is_resolved: false, note: 'MFA non supporté par CyberPanel natif — ticket ouvert' },
    ip_address: '192.168.1.45', user_agent: 'Mozilla/5.0',
    created_at: '2026-05-20T09:30:00Z',
  },
  {
    id: 'at_002', organization_id: 'org_smartwave',
    actor: 'roland@smartwave.io', action: 'member.reviewed',
    target_type: 'member', target_id: 'mem_kader', target_label: 'Kader K.',
    old_value: { last_review: '2026-02-15' }, new_value: { last_review: '2026-05-18' },
    ip_address: '192.168.1.42', user_agent: 'Mozilla/5.0',
    created_at: '2026-05-18T14:00:00Z',
  },
  {
    id: 'at_003', organization_id: 'org_smartwave',
    actor: 'fabrice@smartwave.io', action: 'platform.updated',
    target_type: 'platform', target_id: 'plat_mailjet', target_label: 'Mailjet',
    old_value: { last_check_date: '2026-04-15' }, new_value: { last_check_date: '2026-05-15' },
    ip_address: '192.168.1.48', user_agent: 'Mozilla/5.0',
    created_at: '2026-05-15T11:00:00Z',
  },
  {
    id: 'at_004', organization_id: 'org_smartwave',
    actor: 'system', action: 'alert.generated',
    target_type: 'alert', target_id: 'alert_001', target_label: 'Offboarding Elodie T.',
    old_value: {}, new_value: { severity: 'critical', type: 'member_offboarding' },
    ip_address: '127.0.0.1', user_agent: 'Tracix-Cron/1.0',
    created_at: '2026-05-21T06:00:00Z',
  },
  {
    id: 'at_005', organization_id: 'org_smartwave',
    actor: 'colombe@smartwave.io', action: 'access.viewed',
    target_type: 'platform', target_id: 'plat_cyberpanel', target_label: 'CyberPanel URL',
    old_value: { url_hidden: true }, new_value: { url_hidden: false },
    ip_address: '192.168.1.45', user_agent: 'Mozilla/5.0',
    created_at: '2026-05-20T10:15:00Z',
  },
  {
    id: 'at_006', organization_id: 'org_smartwave',
    actor: 'roland@smartwave.io', action: 'system.patched',
    target_type: 'system', target_id: 'sys_vm_staging', target_label: 'VM Staging',
    old_value: { last_patch_date: '2026-04-10' }, new_value: { last_patch_date: '2026-05-10' },
    ip_address: '192.168.1.42', user_agent: 'Mozilla/5.0',
    created_at: '2026-05-10T10:00:00Z',
  },
  {
    id: 'at_007', organization_id: 'org_smartwave',
    actor: 'kader@smartwave.io', action: 'member.created',
    target_type: 'member', target_id: 'mem_david', target_label: 'David A.',
    old_value: {}, new_value: { team: 'Devs_mobile', account_type: 'nominatif' },
    ip_address: '192.168.1.50', user_agent: 'Mozilla/5.0',
    created_at: '2025-09-01T08:00:00Z',
  },
  {
    id: 'at_008', organization_id: 'org_smartwave',
    actor: 'colombe@smartwave.io', action: 'access.granted',
    target_type: 'access_right', target_id: 'ar_d1', target_label: 'David A. → CyberPanel',
    old_value: { level: 'none' }, new_value: { level: 'admin', granted_by: 'Roland A.' },
    ip_address: '192.168.1.45', user_agent: 'Mozilla/5.0',
    created_at: '2025-09-15T09:00:00Z',
  },
];

// ─── Helpers d'accès ───
export function getMemberAccess(memberId: string): AccessRight[] {
  return ACCESS_RIGHTS.filter((a) => a.member_id === memberId);
}

export function getPlatformAccess(platformId: string): AccessRight[] {
  return ACCESS_RIGHTS.filter((a) => a.platform_id === platformId);
}

export function getAccessLevel(memberId: string, platformId: string): AccessLevel {
  const access = ACCESS_RIGHTS.find((a) => a.member_id === memberId && a.platform_id === platformId);
  return access?.level ?? 'none';
}

export function getMemberById(id: string): Member | undefined {
  return MEMBERS.find((m) => m.id === id);
}

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getActiveMembers(): Member[] {
  return MEMBERS.filter((m) => m.status === 'actif');
}

export function getActivePlatforms(): Platform[] {
  return PLATFORMS.filter((p) => p.status === 'actif');
}

// ─── Stats pour le dashboard ───
export function getDashboardStats() {
  const activeMembers = getActiveMembers();
  const activePlatforms = getActivePlatforms();
  const unresolvedAlerts = ALERTS.filter((a) => !a.is_resolved);

  const adminCount = ACCESS_RIGHTS.filter((a) => a.level === 'admin').length;
  const overdueReviews = ACCESS_RIGHTS.filter((a) => {
    const days = Math.floor((now.getTime() - new Date(a.last_review_date).getTime()) / (1000 * 60 * 60 * 24));
    return days > 90;
  }).length;

  const membersWithoutReview = activeMembers.filter((m) => {
    const access = getMemberAccess(m.id);
    return access.some((a) => {
      const days = Math.floor((now.getTime() - new Date(a.last_review_date).getTime()) / (1000 * 60 * 60 * 24));
      return days > 90;
    });
  }).length;

  const expiringSubs = SUBSCRIPTIONS.filter((s) => {
    const days = Math.floor((new Date(s.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 30 && days > 0;
  }).length;

  const avgRiskScore = Math.round(activeMembers.reduce((sum, m) => sum + m.risk_score, 0) / activeMembers.length);

  return {
    totalMembers: activeMembers.length,
    totalMembersAll: MEMBERS.length,
    totalPlatforms: activePlatforms.length,
    adminCount,
    overdueReviews,
    avgRiskScore,
    membersWithoutReview,
    expiringSubs,
    criticalAlerts: unresolvedAlerts.filter((a) => a.severity === 'critical').length,
    totalAlerts: unresolvedAlerts.length,
  };
}

// ─── Données de graphiques ───
export function getRiskByTeam() {
  const teams = [...new Set(MEMBERS.map((m) => m.team))];
  return teams.map((team) => {
    const members = MEMBERS.filter((m) => m.team === team);
    const avgScore = Math.round(members.reduce((s, m) => s + m.risk_score, 0) / members.length);
    return { team, score: avgScore, count: members.length };
  }).sort((a, b) => a.score - b.score);
}

export function getAccessLevelDistribution() {
  const levels: Record<string, number> = {};
  ACCESS_RIGHTS.forEach((a) => {
    if (a.level !== 'none') {
      levels[a.level] = (levels[a.level] || 0) + 1;
    }
  });
  return [
    { name: 'Admin', value: levels.admin || 0, color: '#E24B4A' },
    { name: 'RW', value: levels.rw || 0, color: '#EF9F27' },
    { name: 'RO', value: levels.ro || 0, color: '#3B82F6' },
    { name: 'REQ', value: levels.req || 0, color: '#8B5CF6' },
  ];
}

export function getRiskHistory() {
  const days = 30;
  const data = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    // Simulation : score qui oscille légèrement
    const baseScore = 52;
    const variation = Math.sin(i * 0.5) * 8 + (i < 5 ? 5 : 0); // Léger pic récent
    data.push({
      date: dateStr,
      score: Math.round(baseScore + variation),
    });
  }
  return data;
}
