import prisma from '../prisma/client';

export interface RiskFactor {
  label: string;
  delta: number;
}

export interface RiskResult {
  score: number;
  factors: RiskFactor[];
}

// Score starts at 100 (fully compliant) and penalties are subtracted.
// score >= 70 → green (Conforme)
// score 40-69 → orange (À surveiller)
// score <= 39 → red (Critique)
export async function computeMemberRisk(memberId: string): Promise<RiskResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      accessRights: {
        include: { platform: true },
      },
      organization: true,
    },
  });

  if (!member) throw new Error(`Member ${memberId} not found`);

  const org = member.organization;
  const accessRights = member.accessRights;
  const activeAccess = accessRights.filter((a) => a.level !== 'none');

  const now = new Date();
  const factors: RiskFactor[] = [];
  let score = 100;

  // ─── 1. Trop d'accès Admin ───
  const adminCount = activeAccess.filter((a) => a.level === 'admin').length;
  if (adminCount > org.max_admin_per_platform) {
    const penalty = 30;
    score -= penalty;
    factors.push({
      label: `${adminCount} accès Admin (seuil: ${org.max_admin_per_platform})`,
      delta: -penalty,
    });
  }

  // ─── 2. Revues d'accès dépassées ───
  const reviewDelay = org.access_review_delay_days;
  const overdueRights = activeAccess.filter((a) => {
    if (!a.last_review_date) return true;
    const daysSince = Math.floor(
      (now.getTime() - new Date(a.last_review_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince > reviewDelay;
  });

  if (overdueRights.length > 0) {
    const maxDays = Math.max(
      ...overdueRights.map((a) =>
        Math.floor(
          (now.getTime() - new Date(a.last_review_date || 0).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    );
    // Penalty scales with how overdue: 25 base + 5 for every extra 30 days, capped at 45
    const penalty = Math.min(45, 25 + Math.floor((maxDays - reviewDelay) / 30) * 5);
    score -= penalty;
    factors.push({
      label: `${overdueRights.length} revue(s) dépassée(s) — plus ancienne: ${maxDays}j`,
      delta: -penalty,
    });
  }

  // ─── 3. Date de départ passée avec accès encore actifs ───
  if (member.departure_date) {
    const departed = new Date(member.departure_date) < now;
    if (departed && member.status === 'actif' && activeAccess.length > 0) {
      const penalty = 40;
      score -= penalty;
      factors.push({
        label: `Date de départ passée (${member.departure_date}), ${activeAccess.length} accès encore actifs`,
        delta: -penalty,
      });
    }
  }

  // ─── 4. Compte partagé / service ───
  const isShared = member.account_type === 'partagé' || member.account_type === 'service';
  if (isShared) {
    if (adminCount > 0) {
      const penalty = 20;
      score -= penalty;
      factors.push({ label: 'Compte partagé avec droits Admin', delta: -penalty });
    } else {
      const penalty = 10;
      score -= penalty;
      factors.push({ label: `Compte ${member.account_type} (accès nominatif recommandé)`, delta: -penalty });
    }
  }

  // ─── 5. Admin sur plateforme sans MFA ───
  const adminNoMfa = activeAccess.filter(
    (a) => a.level === 'admin' && a.platform && !a.platform.has_mfa
  );
  if (adminNoMfa.length > 0) {
    const penalty = 15;
    score -= penalty;
    const names = adminNoMfa.map((a) => a.platform.name).join(', ');
    factors.push({
      label: `Admin sans MFA : ${names}`,
      delta: -penalty,
    });
  }

  // ─── 6. Membre inactif/suspendu avec accès actifs ───
  if (member.status !== 'actif' && activeAccess.length > 0) {
    const penalty = 25;
    score -= penalty;
    factors.push({
      label: `Membre ${member.status} avec ${activeAccess.length} accès encore actifs`,
      delta: -penalty,
    });
  }

  // ─── Bonus : aucun problème détecté ───
  if (factors.length === 0) {
    factors.push({ label: 'Aucun risque détecté — profil conforme', delta: 0 });
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return { score: finalScore, factors };
}

export async function updateMemberRiskScore(memberId: string): Promise<RiskResult> {
  const result = await computeMemberRisk(memberId);

  await prisma.member.update({
    where: { id: memberId },
    data: {
      risk_score: result.score,
      risk_factors: result.factors as unknown as object,
    },
  });

  return result;
}

export async function recomputeAllRiskScores(organizationId: string): Promise<void> {
  const members = await prisma.member.findMany({
    where: { organization_id: organizationId },
    select: { id: true },
  });
  await Promise.all(members.map((m) => updateMemberRiskScore(m.id)));
}
