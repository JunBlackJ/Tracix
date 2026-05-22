"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRiskScore = computeRiskScore;
exports.computeMemberRisk = computeMemberRisk;
exports.updateMemberRiskScore = updateMemberRiskScore;
exports.recomputeAllRiskScores = recomputeAllRiskScores;
const client_1 = __importDefault(require("../prisma/client"));
function computeRiskScore(params) {
    const { adminCount, lastReviewDays, isShared, departureDate, status } = params;
    const factors = [];
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
    }
    else if (isShared) {
        factors.push({ label: 'Compte partagé', delta: 10 });
    }
    if (adminCount <= 2 && lastReviewDays <= 90 && !departureDate && !isShared) {
        factors.push({ label: 'Toutes les revues sont à jour', delta: -20 });
    }
    const raw = factors.reduce((sum, f) => sum + f.delta, 50);
    const score = Math.max(0, Math.min(100, raw));
    return { score, factors };
}
async function computeMemberRisk(memberId) {
    const member = await client_1.default.member.findUnique({
        where: { id: memberId },
        include: { accessRights: true },
    });
    if (!member) {
        throw new Error(`Member ${memberId} not found`);
    }
    const accessRights = member.accessRights;
    const adminCount = accessRights.filter((a) => a.level === 'admin').length;
    const now = new Date();
    let lastReviewDays = 0;
    if (accessRights.length > 0) {
        const mostRecentReview = accessRights.reduce((latest, a) => {
            const d = new Date(a.last_review_date);
            return d < latest ? d : latest;
        }, new Date());
        lastReviewDays = Math.floor((now.getTime() - mostRecentReview.getTime()) / (1000 * 60 * 60 * 24));
    }
    const isShared = member.account_type === 'partagé' || member.account_type === 'service';
    return computeRiskScore({
        adminCount,
        lastReviewDays,
        isShared,
        departureDate: member.departure_date ?? null,
        status: member.status,
    });
}
async function updateMemberRiskScore(memberId) {
    const result = await computeMemberRisk(memberId);
    await client_1.default.member.update({
        where: { id: memberId },
        data: {
            risk_score: result.score,
            risk_factors: result.factors,
        },
    });
    return result;
}
async function recomputeAllRiskScores(organizationId) {
    const members = await client_1.default.member.findMany({
        where: { organization_id: organizationId },
        select: { id: true },
    });
    await Promise.all(members.map((m) => updateMemberRiskScore(m.id)));
}
//# sourceMappingURL=risk.service.js.map