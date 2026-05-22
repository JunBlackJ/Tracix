"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const alert_service_1 = require("../services/alert.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// GET /api/alerts
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { is_resolved, severity, type, source_module } = req.query;
    const where = { organization_id: orgId };
    if (is_resolved !== undefined)
        where.is_resolved = is_resolved === 'true';
    if (severity)
        where.severity = severity;
    if (type)
        where.type = type;
    if (source_module)
        where.source_module = source_module;
    const alerts = await client_1.default.alert.findMany({
        where,
        orderBy: [{ is_resolved: 'asc' }, { created_at: 'desc' }],
    });
    res.json(alerts);
});
// GET /api/alerts/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const alert = await client_1.default.alert.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
    }
    res.json(alert);
});
// PATCH /api/alerts/resolve-all  — must be before /:id/resolve to avoid :id matching "resolve-all"
router.patch('/resolve-all', async (req, res) => {
    const orgId = req.user.organizationId;
    const body = zod_1.z.object({ ids: zod_1.z.array(zod_1.z.string()) }).parse(req.body);
    // Verify all alerts belong to org
    const alertsToResolve = await client_1.default.alert.findMany({
        where: {
            id: { in: body.ids },
            organization_id: orgId,
            is_resolved: false,
        },
    });
    if (alertsToResolve.length === 0) {
        res.json({ resolved: 0 });
        return;
    }
    const today = new Date().toISOString();
    const result = await client_1.default.alert.updateMany({
        where: {
            id: { in: alertsToResolve.map((a) => a.id) },
            organization_id: orgId,
        },
        data: {
            is_resolved: true,
            resolved_by: req.user.email,
            resolved_at: today,
        },
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'alert.bulk_resolved',
        targetType: 'alert',
        targetId: 'bulk',
        targetLabel: `${result.count} alertes résolues`,
        oldValue: {},
        newValue: { resolved_count: result.count, ids: body.ids },
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json({ resolved: result.count });
});
// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', async (req, res) => {
    const orgId = req.user.organizationId;
    const existing = await client_1.default.alert.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Alert not found' });
        return;
    }
    const today = new Date().toISOString();
    const alert = await client_1.default.alert.update({
        where: { id: req.params.id },
        data: {
            is_resolved: true,
            resolved_by: req.user.email,
            resolved_at: today,
        },
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: orgId,
        actor: req.user.email,
        action: 'alert.resolved',
        targetType: 'alert',
        targetId: alert.id,
        targetLabel: alert.message.slice(0, 60),
        oldValue: { is_resolved: false },
        newValue: { is_resolved: true, resolved_by: req.user.email, resolved_at: today },
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json(alert);
});
// POST /api/alerts/generate — trigger alert engine
router.post('/generate', async (req, res) => {
    const orgId = req.user.organizationId;
    await (0, alert_service_1.generateAlerts)(orgId);
    const alerts = await client_1.default.alert.findMany({
        where: { organization_id: orgId, is_resolved: false },
        orderBy: { created_at: 'desc' },
    });
    res.json({ generated: true, alerts });
});
exports.default = router;
//# sourceMappingURL=alerts.js.map