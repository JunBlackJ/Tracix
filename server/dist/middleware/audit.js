"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditEntry = createAuditEntry;
exports.getClientIp = getClientIp;
const client_1 = __importDefault(require("../prisma/client"));
const uuid_1 = require("uuid");
async function createAuditEntry(params) {
    await client_1.default.auditTrail.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: params.organizationId,
            actor: params.actor,
            action: params.action,
            target_type: params.targetType,
            target_id: params.targetId,
            target_label: params.targetLabel,
            old_value: (params.oldValue ?? {}),
            new_value: (params.newValue ?? {}),
            ip_address: params.ipAddress ?? '',
            user_agent: params.userAgent ?? '',
        },
    });
}
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? '';
}
//# sourceMappingURL=audit.js.map