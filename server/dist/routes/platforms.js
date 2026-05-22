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
const PlatformSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    category: zod_1.z.string().default(''),
    access_type: zod_1.z.string().default(''),
    url: zod_1.z.string().default(''),
    auth_method: zod_1.z.string().default(''),
    has_mfa: zod_1.z.boolean().default(false),
    environment: zod_1.z.enum(['production', 'staging', 'dev']).default('production'),
    responsible: zod_1.z.string().default(''),
    target_population: zod_1.z.string().default(''),
    sla: zod_1.z.string().default(''),
    status: zod_1.z.enum(['actif', 'inactif', 'déprécié']).default('actif'),
    last_check_date: zod_1.z.string().default(''),
    notes: zod_1.z.string().default(''),
});
// GET /api/platforms
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { search, status, environment, category } = req.query;
    const where = { organization_id: orgId };
    if (status)
        where.status = status;
    if (environment)
        where.environment = environment;
    if (category)
        where.category = category;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { responsible: { contains: search, mode: 'insensitive' } },
        ];
    }
    const platforms = await client_1.default.platform.findMany({
        where,
        include: {
            accessRights: {
                include: { member: { select: { id: true, full_name: true, username: true } } },
            },
        },
        orderBy: { name: 'asc' },
    });
    res.json(platforms);
});
// GET /api/platforms/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const platform = await client_1.default.platform.findFirst({
        where: { id: req.params.id, organization_id: orgId },
        include: {
            accessRights: {
                include: { member: true },
            },
        },
    });
    if (!platform) {
        res.status(404).json({ error: 'Platform not found' });
        return;
    }
    res.json(platform);
});
// POST /api/platforms
router.post('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = PlatformSchema.parse(req.body);
    const platform = await client_1.default.platform.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: orgId,
            ...body,
        },
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'platform.created',
        targetType: 'platform',
        targetId: platform.id,
        targetLabel: platform.name,
        oldValue: {},
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(201).json(platform);
});
// PUT /api/platforms/:id
router.put('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.platform.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Platform not found' });
        return;
    }
    const body = PlatformSchema.partial().parse(req.body);
    const platform = await client_1.default.platform.update({
        where: { id: req.params.id },
        data: body,
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'platform.updated',
        targetType: 'platform',
        targetId: platform.id,
        targetLabel: platform.name,
        oldValue: existing,
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(platform);
});
// DELETE /api/platforms/:id
router.delete('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.platform.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Platform not found' });
        return;
    }
    await client_1.default.platform.delete({ where: { id: req.params.id } });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'platform.deleted',
        targetType: 'platform',
        targetId: existing.id,
        targetLabel: existing.name,
        oldValue: existing,
        newValue: {},
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=platforms.js.map