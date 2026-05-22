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
const SubscriptionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    category: zod_1.z.string().default(''),
    vendor: zod_1.z.string().default(''),
    cost_monthly: zod_1.z.number().default(0),
    cost_annual: zod_1.z.number().default(0),
    currency: zod_1.z.string().default('EUR'),
    billing_cycle: zod_1.z.enum(['mensuel', 'annuel', 'usage']).default('mensuel'),
    renewal_date: zod_1.z.string().default(''),
    auto_renew: zod_1.z.boolean().default(false),
    responsible: zod_1.z.string().default(''),
    status: zod_1.z.enum(['actif', 'à_résilier', 'expiré', 'en_négociation']).default('actif'),
    contract_url: zod_1.z.string().default(''),
    notes: zod_1.z.string().default(''),
});
// GET /api/subscriptions
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { search, status, category, billing_cycle } = req.query;
    const where = { organization_id: orgId };
    if (status)
        where.status = status;
    if (category)
        where.category = category;
    if (billing_cycle)
        where.billing_cycle = billing_cycle;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { vendor: { contains: search, mode: 'insensitive' } },
        ];
    }
    const subscriptions = await client_1.default.subscription.findMany({
        where,
        orderBy: { renewal_date: 'asc' },
    });
    res.json(subscriptions);
});
// GET /api/subscriptions/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const subscription = await client_1.default.subscription.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
    }
    res.json(subscription);
});
// POST /api/subscriptions
router.post('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = SubscriptionSchema.parse(req.body);
    const subscription = await client_1.default.subscription.create({
        data: {
            id: (0, uuid_1.v4)(),
            organization_id: orgId,
            ...body,
        },
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'subscription.created',
        targetType: 'subscription',
        targetId: subscription.id,
        targetLabel: subscription.name,
        oldValue: {},
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.status(201).json(subscription);
});
// PUT /api/subscriptions/:id
router.put('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.subscription.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
    }
    const body = SubscriptionSchema.partial().parse(req.body);
    const subscription = await client_1.default.subscription.update({
        where: { id: req.params.id },
        data: body,
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'subscription.updated',
        targetType: 'subscription',
        targetId: subscription.id,
        targetLabel: subscription.name,
        oldValue: existing,
        newValue: body,
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(subscription);
});
// DELETE /api/subscriptions/:id
router.delete('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.subscription.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
    }
    await client_1.default.subscription.delete({ where: { id: req.params.id } });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'subscription.deleted',
        targetType: 'subscription',
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
//# sourceMappingURL=subscriptions.js.map