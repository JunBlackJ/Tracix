"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// GET /api/audit-trail
router.get('/', async (req, res) => {
    const orgId = req.user.organizationId;
    const { actor, action, target_type, target_id, page, limit } = req.query;
    const take = Math.min(parseInt(limit || '100', 10), 500);
    const skip = (parseInt(page || '1', 10) - 1) * take;
    const where = { organization_id: orgId };
    if (actor)
        where.actor = { contains: actor, mode: 'insensitive' };
    if (action)
        where.action = { contains: action, mode: 'insensitive' };
    if (target_type)
        where.target_type = target_type;
    if (target_id)
        where.target_id = target_id;
    const [total, entries] = await Promise.all([
        client_1.default.auditTrail.count({ where }),
        client_1.default.auditTrail.findMany({
            where,
            orderBy: { created_at: 'desc' },
            take,
            skip,
        }),
    ]);
    res.json({
        data: entries,
        pagination: {
            total,
            page: parseInt(page || '1', 10),
            limit: take,
            pages: Math.ceil(total / take),
        },
    });
});
// GET /api/audit-trail/:id
router.get('/:id', async (req, res) => {
    const orgId = req.user.organizationId;
    const entry = await client_1.default.auditTrail.findFirst({
        where: { id: req.params.id, organization_id: orgId },
    });
    if (!entry) {
        res.status(404).json({ error: 'Audit trail entry not found' });
        return;
    }
    res.json(entry);
});
exports.default = router;
//# sourceMappingURL=audit.js.map