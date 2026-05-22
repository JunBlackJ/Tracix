"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    const orgId = req.user.organizationId;
    const now = new Date();
    const org = await client_1.default.organization.findUnique({ where: { id: orgId } });
    if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
    }
    const [allMembers, activeMembers, platforms, activePlatforms, allAccessRights, subscriptions, unresolvedAlerts, systems,] = await Promise.all([
        client_1.default.member.findMany({ where: { organization_id: orgId } }),
        client_1.default.member.findMany({ where: { organization_id: orgId, status: 'actif' } }),
        client_1.default.platform.findMany({ where: { organization_id: orgId } }),
        client_1.default.platform.findMany({ where: { organization_id: orgId, status: 'actif' } }),
        client_1.default.accessRight.findMany({ where: { organization_id: orgId } }),
        client_1.default.subscription.findMany({ where: { organization_id: orgId, status: 'actif' } }),
        client_1.default.alert.findMany({ where: { organization_id: orgId, is_resolved: false } }),
        client_1.default.system.findMany({ where: { organization_id: orgId } }),
    ]);
    const adminCount = allAccessRights.filter((a) => a.level === 'admin').length;
    const overdueThreshold = new Date(now.getTime() - org.access_review_delay_days * 24 * 60 * 60 * 1000);
    const overdueReviews = allAccessRights.filter((a) => {
        if (!a.last_review_date)
            return false;
        return new Date(a.last_review_date) < overdueThreshold;
    }).length;
    // Members with at least one overdue review
    const memberAccessMap = new Map();
    for (const ar of allAccessRights) {
        if (!memberAccessMap.has(ar.member_id)) {
            memberAccessMap.set(ar.member_id, []);
        }
        memberAccessMap.get(ar.member_id).push(ar);
    }
    const membersWithoutReview = activeMembers.filter((m) => {
        const access = memberAccessMap.get(m.id) ?? [];
        return access.some((a) => {
            if (!a.last_review_date)
                return false;
            return new Date(a.last_review_date) < overdueThreshold;
        });
    }).length;
    const expiringSubs = subscriptions.filter((s) => {
        if (!s.renewal_date)
            return false;
        const days = Math.floor((new Date(s.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days <= org.subscription_alert_days && days > 0;
    }).length;
    const avgRiskScore = activeMembers.length > 0
        ? Math.round(activeMembers.reduce((sum, m) => sum + m.risk_score, 0) / activeMembers.length)
        : 0;
    const criticalAlerts = unresolvedAlerts.filter((a) => a.severity === 'critical').length;
    // Risk by team
    const teamMap = new Map();
    for (const m of allMembers) {
        if (!teamMap.has(m.team)) {
            teamMap.set(m.team, { scores: [], count: 0 });
        }
        const t = teamMap.get(m.team);
        t.scores.push(m.risk_score);
        t.count++;
    }
    const riskByTeam = Array.from(teamMap.entries()).map(([team, data]) => ({
        team,
        score: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
        count: data.count,
    })).sort((a, b) => a.score - b.score);
    // Access level distribution
    const levelCounts = {};
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
    const riskHistory = [];
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
        riskByTeam,
        accessLevelDistribution,
        riskHistory,
    });
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map