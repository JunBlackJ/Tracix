// ═══════════════════════════════════════════
// Plan limits & guards
// ═══════════════════════════════════════════

export type PlanId = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  members: number;        // -1 = illimité
  platforms: number;
  customModules: number;
  categories: number;
  seats: number;          // nombre d'utilisateurs Tracix (admin + invités)
  exportEnabled: boolean;
  customModulesEnabled: boolean;
  invitationsEnabled: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    members: 25,
    platforms: 3,
    customModules: 0,
    categories: 5,
    seats: 3,
    exportEnabled: false,
    customModulesEnabled: false,
    invitationsEnabled: true,
  },
  pro: {
    members: -1,
    platforms: -1,
    customModules: -1,
    categories: -1,
    seats: 5,
    exportEnabled: true,
    customModulesEnabled: true,
    invitationsEnabled: true,
  },
  enterprise: {
    members: -1,
    platforms: -1,
    customModules: -1,
    categories: -1,
    seats: -1,
    exportEnabled: true,
    customModulesEnabled: true,
    invitationsEnabled: true,
  },
};

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as PlanId)] ?? PLAN_LIMITS.free;
}

export function checkLimit(current: number, limit: number, label: string): string | null {
  if (limit === -1) return null;
  if (current >= limit) {
    return `Limite ${label} atteinte (${limit} max sur votre plan). Passez à Pro pour continuer.`;
  }
  return null;
}
