// ═══════════════════════════════════════════
// Types Tracix — Plateforme de gouvernance IT
// ═══════════════════════════════════════════

// ─── Organisations ───
export type ModuleId =
  | 'habilitations' | 'membres' | 'plateformes' | 'score-de-risque'
  | 'systemes' | 'flux-reseau' | 'abonnements' | 'alertes'
  | 'journal' | 'rapports' | 'import';

export interface Organization {
  id: string;
  name: string;
  logo_url: string;
  plan: 'free' | 'pro' | 'enterprise';
  plan_expires_at: string | null;
  max_admin_per_platform: number;
  access_review_delay_days: number;
  subscription_alert_days: number;
  enabled_modules: ModuleId[];
  created_at: string;
  alert_email_enabled: boolean;
  alert_email_address: string;
  alert_email_frequency: 'immediate' | 'daily';
  onboarding_completed: boolean;
}

// ─── Utilisateurs ───
export interface UserApp {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  last_login_at: string;
  created_at: string;
}

// ─── Plateformes ───
export interface Platform {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  access_type: string;
  url: string;
  auth_method: string;
  has_mfa: boolean;
  environment: 'production' | 'staging' | 'dev';
  responsible: string;
  target_population: string;
  sla: string;
  status: 'actif' | 'inactif' | 'déprécié';
  last_check_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Membres ───
export type AccountType = 'privilégié' | 'nominatif' | 'service' | 'partagé';
export type MemberStatus = 'actif' | 'inactif' | 'suspendu';

export interface Member {
  id: string;
  organization_id: string;
  full_name: string;
  username: string;
  team: string;
  account_type: AccountType;
  status: MemberStatus;
  email: string;
  departure_date: string | null;
  risk_score: number;
  risk_factors: RiskFactor[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RiskFactor {
  label: string;
  delta: number;
}

// ─── Droits d'accès ───
export type AccessLevel = 'admin' | 'rw' | 'ro' | 'req' | 'none';

export interface AccessRight {
  id: string;
  organization_id: string;
  member_id: string;
  platform_id: string;
  level: AccessLevel;
  granted_at: string;
  granted_by: string;
  last_review_date: string;
  next_review_date: string;
  reviewed_by: string;
  notes: string;
}

// ─── Journal des revues d'accès ───
export type ReviewDecision = 'confirmed' | 'revoked' | 'downgraded' | 'upgraded';

export interface ReviewCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'cancelled';
  created_by: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  totalItems: number;
  pendingItems: number;
  completedItems: number;
}

export interface ReviewItem {
  id: string;
  campaign_id: string;
  organization_id: string;
  member_id: string;
  platform_id: string;
  access_right_id: string;
  original_level: string;
  decision: 'pending' | 'confirmed' | 'revoked' | 'modified';
  new_level: string;
  comment: string;
  reviewed_by: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface AccessReviewLog {
  id: string;
  organization_id: string;
  access_right_id: string;
  reviewed_by: string;
  decision: ReviewDecision;
  old_level: AccessLevel;
  new_level: AccessLevel;
  reviewed_at: string;
  comment: string;
  ip_address: string;
}

// ─── Offboarding ───
export interface OffboardingChecklist {
  id: string;
  organization_id: string;
  member_id: string;
  initiated_by: string;
  initiated_at: string;
  completed_at: string | null;
  status: 'en_cours' | 'complété' | 'annulé';
}

export interface OffboardingItem {
  id: string;
  checklist_id: string;
  platform_id: string;
  access_level_to_revoke: string;
  is_revoked: boolean;
  revoked_by: string;
  revoked_at: string;
  notes: string;
}

// ─── Systèmes ───
export type Criticality = 'critique' | 'élevée' | 'normale' | 'faible';
export type SystemStatus = 'actif' | 'inactif' | 'maintenance';

export interface System {
  id: string;
  organization_id: string;
  system_id: string;
  hostname: string;
  type: string;
  environment: 'production' | 'staging' | 'dev';
  os_version: string;
  ip_address: string;
  vlan: string;
  location: string;
  role_usage: string;
  owner: string;
  tech_responsible: string;
  criticality: Criticality;
  status: SystemStatus;
  deployment_date: string;
  end_of_support_date: string;
  backup_policy: string;
  last_patch_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Flux réseau ───
export type FlowDirection = 'entrant' | 'sortant' | 'bidirectionnel';
export type FlowStatus = 'autorisé' | 'bloqué' | 'conditionnel';

export interface NetworkFlow {
  id: string;
  organization_id: string;
  flow_id: string;
  source_host: string;
  source_zone: string;
  destination_host: string;
  destination_zone: string;
  port: string;
  protocol: string;
  service: string;
  direction: FlowDirection;
  status: FlowStatus;
  firewall_rule: string;
  justification: string;
  responsible: string;
  last_review_date: string;
  created_at: string;
  updated_at: string;
}

// ─── Abonnements ───
export type BillingCycle = 'mensuel' | 'annuel' | 'usage' | 'hebdomadaire';
export type SubscriptionStatus = 'actif' | 'à_résilier' | 'expiré' | 'en_négociation';

export interface Subscription {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  vendor: string;
  cost_monthly: number;
  cost_annual: number;
  cost_weekly: number;
  currency: string;
  billing_cycle: BillingCycle;
  renewal_date: string;
  auto_renew: boolean;
  responsible: string;
  status: SubscriptionStatus;
  contract_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Scores de risque ───
export interface RiskScore {
  id: string;
  organization_id: string;
  source_type: 'member' | 'platform' | 'system' | 'subscription';
  source_id: string;
  score: number;
  factors: RiskFactor[];
  computed_at: string;
}

// ─── Alertes ───
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'access_review_overdue'
  | 'admin_count_high'
  | 'member_offboarding'
  | 'orphan_account'
  | 'no_mfa_on_admin'
  | 'shared_account_admin'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'system_end_of_support'
  | 'system_not_patched'
  | 'flow_review_overdue';

export interface Alert {
  id: string;
  organization_id: string;
  source_module: 'habilitation' | 'système' | 'réseau' | 'abonnement';
  source_id: string;
  source_label: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  is_resolved: boolean;
  resolved_by: string;
  resolved_at: string;
  created_at: string;
}

// ─── Audit trail ───
export interface AuditTrail {
  id: string;
  organization_id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// ─── Modules personnalisés ───
export type CustomModuleType = 'liste' | 'contacts' | 'documents' | 'procedures' | 'notes' | 'kpis';

export interface CustomModule {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  module_type: CustomModuleType;
  icon: string;
  color: string;
  nav_order: number;
  created_at: string;
  updated_at: string;
  _count?: { entries: number };
}

export interface CustomEntry {
  id: string;
  module_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Catégories personnalisées ───
export type CategoryType = 'subscription' | 'platform' | 'team';

export interface Category {
  id: string;
  organization_id: string;
  type: CategoryType;
  label: string;
  color: string;
  created_at: string;
}

// ─── Auth context ───
export interface AuthState {
  user: UserApp | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Access level badge config ───
export const ACCESS_LEVEL_CONFIG: Record<AccessLevel, { label: string; bg: string; text: string }> = {
  admin: { label: 'A', bg: 'bg-red-100', text: 'text-red-800' },
  rw: { label: 'RW', bg: 'bg-amber-100', text: 'text-amber-800' },
  ro: { label: 'RO', bg: 'bg-blue-100', text: 'text-blue-800' },
  req: { label: 'REQ', bg: 'bg-purple-100', text: 'text-purple-800' },
  none: { label: '—', bg: 'bg-gray-100', text: 'text-gray-400' },
};

// ─── Risk score colors ───
export const RISK_COLORS = {
  critical: '#E24B4A',
  warning: '#EF9F27',
  good: '#1D9E75',
};

export function getRiskColor(score: number): string {
  if (score <= 39) return RISK_COLORS.critical;
  if (score <= 69) return RISK_COLORS.warning;
  return RISK_COLORS.good;
}

export function getRiskLabel(score: number): string {
  if (score <= 39) return 'Critique';
  if (score <= 69) return 'À surveiller';
  return 'Conforme';
}

// ─── Alert severity config ───
export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: 'Critique', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  warning: { label: 'Warning', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  info: { label: 'Info', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};
