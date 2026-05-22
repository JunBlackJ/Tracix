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
const MemberSchema = zod_1.z.object({
    full_name: zod_1.z.string().min(1),
    username: zod_1.z.string().min(1),
    team: zod_1.z.string().default(''),
    account_type: zod_1.z.enum(['privilégié', 'nominatif', 'service', 'partagé']),
    status: zod_1.z.enum(['actif', 'inactif', 'suspendu']).default('actif'),
    email: zod_1.z.string().email(),
    departure_date: zod_1.z.string().nullable().optional(),
    notes: zod_1.z.string().default(''),
});
// GET /api/members
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { search, status, team, account_type } = req.query;
    const where = { organization_id: orgId };
    if (status)
        where.status = status;
    if (team)
        where.team = team;
    if (account_type)
        where.account_type = account_type;
    if (search) {
        where.OR = [
            { full_name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
        ];
    }
    const members = await client_1.default.member.findMany({
        where,
        include: { accessRights: true },
        orderBy: { full_name: 'asc' },
    });
    res.json(members);
});
// GET /api/members/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const member = await client_1.default.member.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            accessRights: {
                include: { platform: true },
            },
        },
    });
    if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
    }
    res.json(member);
});
// GET /api/members/:id/risk
router.get('/:id/risk', async (req, res) => {
    const orgId = req.user.organizationId;
    const member = await client_1.default.member.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
    }
    const result = await (0, risk_service_1.updateMemberRiskScore)(req.params.id);
    res.json(result);
});
// POST /api/members
router.post('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = MemberSchema.parse(req.body);
    const member = await client_1.default.member.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: orgId,
            ...body,
            departure_date: body.departure_date ?? null,
            risk_score: 50,
            risk_factors: [],
        },
    });
    await (0, risk_service_1.updateMemberRiskScore)(member.id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'member.created',
        targetType: 'member',
        targetId: member.id,
        targetLabel: member.full_name,
        oldValue: {},
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    const updated = await client_1.default.member.findUnique({ where: { id: member.id } });
    res.status(201).json(updated);
});
// PUT /api/members/:id
router.put('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.member.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Member not found' });
        return;
    }
    const body = MemberSchema.partial().parse(req.body);
    const member = await client_1.default.member.update({
        where: { id: req.params.id },
        data: { ...body, departure_date: body.departure_date === undefined ? undefined : (body.departure_date ?? null) },
    });
    await (0, risk_service_1.updateMemberRiskScore)(member.id);
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'member.updated',
        targetType: 'member',
        targetId: member.id,
        targetLabel: member.full_name,
        oldValue: existing,
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    const updated = await client_1.default.member.findUnique({ where: { id: member.id } });
    res.json(updated);
});
// DELETE /api/members/:id
router.delete('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.member.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Member not found' });
        return;
    }
    await client_1.default.member.delete({ where: { id: req.params.id } });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'member.deleted',
        targetType: 'member',
        targetId: existing.id,
        targetLabel: existing.full_name,
        oldValue: existing,
        newValue: {},
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=members.js.map