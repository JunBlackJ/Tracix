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
const SystemSchema = zod_1.z.object({
    system_id: zod_1.z.string().min(1),
    hostname: zod_1.z.string().min(1),
    type: zod_1.z.string().default(''),
    environment: zod_1.z.enum(['production', 'staging', 'dev']).default('production'),
    os_version: zod_1.z.string().default(''),
    ip_address: zod_1.z.string().default(''),
    vlan: zod_1.z.string().default(''),
    location: zod_1.z.string().default(''),
    role_usage: zod_1.z.string().default(''),
    owner: zod_1.z.string().default(''),
    tech_responsible: zod_1.z.string().default(''),
    criticality: zod_1.z.enum(['critique', 'élevée', 'normale', 'faible']).default('normale'),
    status: zod_1.z.enum(['actif', 'inactif', 'maintenance']).default('actif'),
    deployment_date: zod_1.z.string().default(''),
    end_of_support_date: zod_1.z.string().default(''),
    backup_policy: zod_1.z.string().default(''),
    last_patch_date: zod_1.z.string().default(''),
    notes: zod_1.z.string().default(''),
});
// GET /api/systems
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { search, status, environment, criticality } = req.query;
    const where = { organization_id: orgId };
    if (status)
        where.status = status;
    if (environment)
        where.environment = environment;
    if (criticality)
        where.criticality = criticality;
    if (search) {
        where.OR = [
            { hostname: { contains: search, mode: 'insensitive' } },
            { system_id: { contains: search, mode: 'insensitive' } },
            { owner: { contains: search, mode: 'insensitive' } },
        ];
    }
    const systems = await client_1.default.system.findMany({
        where,
        orderBy: { hostname: 'asc' },
    });
    res.json(systems);
});
// GET /api/systems/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const system = await client_1.default.system.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!system) {
        res.status(404).json({ error: 'System not found' });
        return;
    }
    res.json(system);
});
// POST /api/systems
router.post('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = SystemSchema.parse(req.body);
    const system = await client_1.default.system.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: orgId,
            ...body,
        },
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'system.created',
        targetType: 'system',
        targetId: system.id,
        targetLabel: system.hostname,
        oldValue: {},
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(201).json(system);
});
// PUT /api/systems/:id
router.put('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.system.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'System not found' });
        return;
    }
    const body = SystemSchema.partial().parse(req.body);
    const system = await client_1.default.system.update({
        where: { id: req.params.id },
        data: body,
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'system.updated',
        targetType: 'system',
        targetId: system.id,
        targetLabel: system.hostname,
        oldValue: existing,
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(system);
});
// DELETE /api/systems/:id
router.delete('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.system.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'System not found' });
        return;
    }
    await client_1.default.system.delete({ where: { id: req.params.id } });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'system.deleted',
        targetType: 'system',
        targetId: existing.id,
        targetLabel: existing.hostname,
        oldValue: existing,
        newValue: {},
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=systems.js.map