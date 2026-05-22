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
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const NetworkFlowSchema = zod_1.z.object({
    flow_id: zod_1.z.string().min(1),
    source_host: zod_1.z.string().default(''),
    source_zone: zod_1.z.string().default(''),
    destination_host: zod_1.z.string().default(''),
    destination_zone: zod_1.z.string().default(''),
    port: zod_1.z.string().default(''),
    protocol: zod_1.z.string().default(''),
    service: zod_1.z.string().default(''),
    direction: zod_1.z.enum(['entrant', 'sortant', 'bidirectionnel']).default('entrant'),
    status: zod_1.z.enum(['autorisé', 'bloqué', 'conditionnel']).default('autorisé'),
    firewall_rule: zod_1.z.string().default(''),
    justification: zod_1.z.string().default(''),
    responsible: zod_1.z.string().default(''),
    last_review_date: zod_1.z.string().default(''),
});
// GET /api/network-flows
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { search, status, direction } = req.query;
    const where = { organization_id: orgId };
    if (status)
        where.status = status;
    if (direction)
        where.direction = direction;
    if (search) {
        where.OR = [
            { flow_id: { contains: search, mode: 'insensitive' } },
            { source_host: { contains: search, mode: 'insensitive' } },
            { destination_host: { contains: search, mode: 'insensitive' } },
            { service: { contains: search, mode: 'insensitive' } },
        ];
    }
    const flows = await client_1.default.networkFlow.findMany({
        where,
        orderBy: { flow_id: 'asc' },
    });
    res.json(flows);
});
// GET /api/network-flows/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const flow = await client_1.default.networkFlow.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!flow) {
        res.status(404).json({ error: 'Network flow not found' });
        return;
    }
    res.json(flow);
});
// POST /api/network-flows
router.post('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = NetworkFlowSchema.parse(req.body);
    const flow = await client_1.default.networkFlow.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: orgId,
            ...body,
        },
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'flow.created',
        targetType: 'network_flow',
        targetId: flow.id,
        targetLabel: flow.flow_id,
        oldValue: {},
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(201).json(flow);
});
// PUT /api/network-flows/:id
router.put('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.networkFlow.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Network flow not found' });
        return;
    }
    const body = NetworkFlowSchema.partial().parse(req.body);
    const flow = await client_1.default.networkFlow.update({
        where: { id: req.params.id },
        data: body,
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'flow.updated',
        targetType: 'network_flow',
        targetId: flow.id,
        targetLabel: flow.flow_id,
        oldValue: existing,
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(flow);
});
// DELETE /api/network-flows/:id
router.delete('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.networkFlow.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Network flow not found' });
        return;
    }
    await client_1.default.networkFlow.delete({ where: { id: req.params.id } });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'flow.deleted',
        targetType: 'network_flow',
        targetId: existing.id,
        targetLabel: existing.flow_id,
        oldValue: existing,
        newValue: {},
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=flows.js.map