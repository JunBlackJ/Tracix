// Plan limits helper — client-side mirror of server/src/services/plan.service.ts
// Keep in sync if server limits change.

export type PlanId = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  members: number;        // -1 = unlimited
  platforms: number;
  seats: number;
  exportEnabled: boolean;
  customModulesEnabled: boolean;
}

const LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    members: 25,
    platforms: -1,
    seats: 3,
    exportEnabled: false,
    customModulesEnabled: false,
  },
  pro: {
    members: -1,
    platforms: -1,
    seats: 5,
    exportEnabled: true,
    customModulesEnabled: true,
  },
  enterprise: {
    members: -1,
    platforms: -1,
    seats: -1,
    exportEnabled: true,
    customModulesEnabled: true,
  },
};

export function getPlanLimits(plan?: string | null): PlanLimits {
  return LIMITS[(plan as PlanId)] ?? LIMITS.free;
}

export function isAtLimit(current: number, limit: number): boolean {
  return limit !== -1 && current >= limit;
}

export const UPGRADE_MSG = 'Passez à Pro pour accéder à cette fonctionnalité.';
export const LIMIT_MSG = (label: string, limit: number) =>
  `Limite atteinte (${limit} ${label} max sur le plan gratuit). Passez à Pro.`;
export const EXPORT_USED_MSG = 'Export unique déjà utilisé sur le plan gratuit. Passez à Pro pour des exports illimités.';
