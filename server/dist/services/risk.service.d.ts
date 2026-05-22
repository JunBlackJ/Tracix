export interface RiskFactor {
    label: string;
    delta: number;
}
export interface RiskResult {
    score: number;
    factors: RiskFactor[];
}
export declare function computeRiskScore(params: {
    adminCount: number;
    lastReviewDays: number;
    isShared: boolean;
    departureDate: string | null;
    status: string;
}): RiskResult;
export declare function computeMemberRisk(memberId: string): Promise<RiskResult>;
export declare function updateMemberRiskScore(memberId: string): Promise<RiskResult>;
export declare function recomputeAllRiskScores(organizationId: string): Promise<void>;
//# sourceMappingURL=risk.service.d.ts.map