import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard/stats
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const now = new Date();

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }

  const [
    allMembers,
    activeMembers,
    platforms,
    activePlatforms,
    allAccessRights,
    subscriptions,
    unresolvedAlerts,
    systems,
  ] = await Promise.all([
    prisma.member.findMany({ where: { organization_id: orgId } }),
    prisma.member.findMany({ where: { organization_id: orgId, status: 'actif' } }),
    prisma.platform.findMany({ where: { organization_id: orgId } }),
    prisma.platform.findMany({ where: { organization_id: orgId, status: 'actif' } }),
    prisma.accessRight.findMany({ where: { organization_id: orgId } }),
    prisma.subscription.findMany({ where: { organization_id: orgId, status: 'actif' } }),
    prisma.alert.findMany({ where: { organization_id: orgId, is_resolved: false } }),
    prisma.system.findMany({ where: { organization_id: orgId } }),
  ]);

  const adminCount = allAccessRights.filter((a) => a.level === 'admin').length;

  const overdueThreshold = new Date(now.getTime() - org.access_review_delay_days * 24 * 60 * 60 * 1000);
  const overdueReviews = allAccessRights.filter((a) => {
    if (!a.last_review_date) return false;
    return new Date(a.last_review_date) < overdueThreshold;
  }).length;

  // Members with at least one overdue review
  const memberAccessMap = new Map<string, typeof allAccessRights>();
  for (const ar of allAccessRights) {
    if (!memberAccessMap.has(ar.member_id)) {
      memberAccessMap.set(ar.member_id, []);
    }
    memberAccessMap.get(ar.member_id)!.push(ar);
  }

  const membersWithoutReview = activeMembers.filter((m) => {
    const access = memberAccessMap.get(m.id) ?? [];
    return access.some((a) => {
      if (!a.last_review_date) return false;
      return new Date(a.last_review_date) < overdueThreshold;
    });
  }).length;

  const expiringSubs = subscriptions.filter((s) => {
    if (!s.renewal_date) return false;
    const days = Math.floor((new Date(s.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days <= org.subscription_alert_days && days > 0;
  }).length;

  const avgRiskScore = activeMembers.length > 0
    ? Math.round(activeMembers.reduce((sum, m) => sum + m.risk_score, 0) / activeMembers.length)
    : 0;

  const criticalAlerts = unresolvedAlerts.filter((a) => a.severity === 'critical').length;

  // Risk distribution — risk_score est un score de conformité (100 = bon, 0 = dangereux)
  const riskDistribution = {
    crit: allMembers.filter((m) => m.risk_score <= 39).length,
    high: allMembers.filter((m) => m.risk_score >= 40 && m.risk_score <= 59).length,
    med:  allMembers.filter((m) => m.risk_score >= 60 && m.risk_score <= 79).length,
    low:  allMembers.filter((m) => m.risk_score >= 80).length,
  };

  const totalAccessRights = allAccessRights.filter((a) => a.level !== 'none').length;

  // Risk by team
  const teamMap = new Map<string, { scores: number[]; count: number }>();
  for (const m of allMembers) {
    if (!teamMap.has(m.team)) {
      teamMap.set(m.team, { scores: [], count: 0 });
    }
    const t = teamMap.get(m.team)!;
    t.scores.push(m.risk_score);
    t.count++;
  }
  const riskByTeam = Array.from(teamMap.entries()).map(([team, data]) => ({
    team,
    score: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
    count: data.count,
  })).sort((a, b) => a.score - b.score);

  // Access level distribution
  const levelCounts: Record<string, number> = {};
  for (const ar of allAccessRights) {
    if (ar.level !== 'none') {
      levelCounts[ar.level] = (levelCounts[ar.level] ?? 0) + 1;
    }
  }
  const accessLevelDistribution = [
    { name: 'Admin', value: levelCounts['admin'] ?? 0, color: '#E24B4A' },
    { name: 'RW', value: levelCounts['rw'] ?? 0, color: '#EF9F27' },
    { name: 'RO', value: levelCounts['ro'] ?? 0, color: '#3B82F6' },
    { name: 'REQ', value: levelCounts['req'] ?? 0, color: '#8B5CF6' },
  ];

  // Risk history (30 days simulation based on actual avg score)
  const riskHistory: { date: string; score: number }[] = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const variation = Math.sin(i * 0.5) * 8 + (i < 5 ? 5 : 0);
    riskHistory.push({
      date: dateStr,
      score: Math.round(avgRiskScore + variation - 8),
    });
  }

  res.json({
    totalMembers: activeMembers.length,
    totalMembersAll: allMembers.length,
    totalPlatforms: activePlatforms.length,
    totalPlatformsAll: platforms.length,
    totalSystems: systems.length,
    adminCount,
    overdueReviews,
    avgRiskScore,
    membersWithoutReview,
    expiringSubs,
    criticalAlerts,
    totalAlerts: unresolvedAlerts.length,
    totalAccessRights,
    riskDistribution,
    riskByTeam,
    accessLevelDistribution,
    riskHistory,
  });
});

export default router;
