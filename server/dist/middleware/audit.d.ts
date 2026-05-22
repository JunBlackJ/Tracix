import { Request } from 'express';
export declare function createAuditEntry(params: {
    organizationId: string;
    actor: string;
    action: string;
    targetType: string;
    targetId: string;
    targetLabel: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void>;
export declare function getClientIp(req: Request): string;
//# sourceMappingURL=audit.d.ts.map