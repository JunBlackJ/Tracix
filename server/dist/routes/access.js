"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const risk_service_1 = require("../services/risk.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const AccessRightSchema = zod_1.z.object({
    member_id: zod_1.z.string(),
    platform_id: zod_1.z.string(),
    level: zod_1.z.enum(['admin', 'rw', 'ro', 'req', 'none']),
    granted_by: zod_1.z.string().default(''),
    last_review_date: zod_1.z.string().default(''),
    next_review_date: zod_1.z.string().default(''),
    reviewed_by: zod_1.z.string().default(''),
    notes: zod_1.z.string().default(''),
});
const UpdateLevelSchema = zod_1.z.object({
    level: zod_1.z.enum(['admin', 'rw', 'ro', 'req', 'none']),
    comment: zod_1.z.string().optional(),
});
// GET /api/access-rights
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { member_id, platform_id, level } = req.query;
    const where = { organization_id: orgId };
    if (member_id)
        where.member_id = member_id;
    if (platform_id)
        where.platform_id = platform_id;
    if (level)
        where.level = level;
    const accessRights = await client_1.default.accessRight.findMany({
        where,
        include: {
            member: { select: { id: true, full_name: true, username: true, account_type: true, status: true } },
            platform: { select: { id: true, name: true, category: true, has_mfa: true } },
        },
        orderBy: [{ member_id: 'asc' }, { platform_id: 'asc' }],
    });
    res.json(accessRights);
});
// GET /api/access-rights/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const ar = await client_1.default.accessRight.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            member: true,
            platform: true,
        },
    });
    if (!ar) {
        res.status(404).json({ error: 'Access right not found' });
        return;
    }
    res.json(ar);
});
// POST /api/access-rights
router.post('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = AccessRightSchema.parse(req.body);
    // Verify member and platform belong to org
    const [member, platform] = await Promise.all([
        client_1.default.member.findFirst({ where: { id: body.member_id, organization_id: orgId } }),
        client_1.default.platform.findFirst({ where: { id: body.platform_id, organization_id: orgId } }),
    ]);
    if (!member) {
        res.status(400).json({ error: 'Member not found in organization' });
        return;
    }
    if (!platform) {
        res.status(400).json({ error: 'Platform not found in organization' });
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const accessRight = await client_1.default.accessRight.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: orgId,
            ...body,
            granted_at: today,
            last_review_date: body.last_review_date || today,
        },
    });
    await (0, risk_service_1.updateMemberRiskScore)(body.member_id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'access.granted',
        targetType: 'access_right',
        targetId: accessRight.id,
        targetLabel: `${member.full_name} → ${platform.name}`,
        oldValue: { level: 'none' },
        newValue: { level: body.level, granted_by: body.granted_by },
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(201).json(accessRight);
});
// PUT /api/access-rights/:id
router.put('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.accessRight.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            member: { select: { full_name: true } },
            platform: { select: { name: true } },
        },
    });
    if (!existing) {
        res.status(404).json({ error: 'Access right not found' });
        return;
    }
    const body = AccessRightSchema.partial().omit({ member_id: true, platform_id: true }).parse(req.body);
    const updated = await client_1.default.accessRight.update({
        where: { id: req.params.id },
        data: body,
    });
    await (0, risk_service_1.updateMemberRiskScore)(existing.member_id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'access.updated',
        targetType: 'access_right',
        targetId: updated.id,
        targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
        oldValue: existing,
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(updated);
});
// PUT /api/access-rights/:id/level — update access level with audit
router.put('/:id/level', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = UpdateLevelSchema.parse(req.body);
    const existing = await client_1.default.accessRight.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            member: { select: { full_name: true } },
            platform: { select: { name: true } },
        },
    });
    if (!existing) {
        res.status(404).json({ error: 'Access right not found' });
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const updated = await client_1.default.accessRight.update({
        where: { id: req.params.id },
        data: {
            level: body.level,
            last_review_date: today,
            reviewed_by: req.user.email,
            notes: body.comment ? `${existing.notes ? existing.notes + ' | ' : ''}${body.comment}` : existing.notes,
        },
    });
    await (0, risk_service_1.updateMemberRiskScore)(existing.member_id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'access.level_changed',
        targetType: 'access_right',
        targetId: updated.id,
        targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
        oldValue: { level: existing.level },
        newValue: { level: body.level, comment: body.comment ?? '' },
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(updated);
});
// POST /api/access-rights/:id/revoke — revoke access
router.post('/:id/revoke', async (req, res) => {
    const orgId = req.user.organizationId;
    const { comment } = zod_1.z.object({ comment: zod_1.z.string().optional() }).parse(req.body);
    const existing = await client_1.default.accessRight.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            member: { select: { full_name: true } },
            platform: { select: { name: true } },
        },
    });
    if (!existing) {
        res.status(404).json({ error: 'Access right not found' });
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const updated = await client_1.default.accessRight.update({
        where: { id: req.params.id },
        data: {
            level: 'none',
            last_review_date: today,
            reviewed_by: req.user.email,
            notes: comment ? `${existing.notes ? existing.notes + ' | ' : ''}Révoqué: ${comment}` : existing.notes,
        },
    });
    await (0, risk_service_1.updateMemberRiskScore)(existing.member_id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'access.revoked',
        targetType: 'access_right',
        targetId: updated.id,
        targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
        oldValue: { level: existing.level },
        newValue: { level: 'none', comment: comment ?? '' },
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(updated);
});
// DELETE /api/access-rights/:id
router.delete('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.accessRight.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            member: { select: { full_name: true } },
            platform: { select: { name: true } },
        },
    });
    if (!existing) {
        res.status(404).json({ error: 'Access right not found' });
        return;
    }
    await client_1.default.accessRight.delete({ where: { id: req.params.id } });
    await (0, risk_service_1.updateMemberRiskScore)(existing.member_id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'access.deleted',
        targetType: 'access_right',
        targetId: existing.id,
        targetLabel: `${existing.member.full_name} → ${existing.platform.name}`,
        oldValue: existing,
        newValue: {},
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=access.js.map