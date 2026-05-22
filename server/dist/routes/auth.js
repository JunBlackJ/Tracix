"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const router = (0, express_1.Router)();
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    const body = LoginSchema.parse(req.body);
    const user = await client_1.default.userApp.findUnique({
        where: { email: body.email },
        include: { organization: true },
    });
    if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    const passwordValid = await bcrypt_1.default.compare(body.password, user.password_hash);
    if (!passwordValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    // Update last_login_at
    await client_1.default.userApp.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
    });
    const token = (0, auth_1.generateToken)({
        userId: user.id,
        organizationId: user.organization_id,
        email: user.email,
        role: user.role,
    });
    await (0, audit_1.createAuditEntry)({
        organizationId: user.organization_id,
        actor: user.email,
        action: 'auth.login',
        targetType: 'user',
        targetId: user.id,
        targetLabel: user.full_name,
        oldValue: {},
        newValue: { last_login_at: new Date().toISOString() },
        ipAddress: (0, audit_1.getClientIp)(req),
        userAgent: req.headers['user-agent'] ?? '',
    });
    res.json({
        token,
        user: {
            id: user.id,
            organization_id: user.organization_id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
        },
        organization: {
            id: user.organization.id,
            name: user.organization.name,
            logo_url: user.organization.logo_url,
            plan: user.organization.plan,
            max_admin_per_platform: user.organization.max_admin_per_platform,
            access_review_delay_days: user.organization.access_review_delay_days,
            subscription_alert_days: user.organization.subscription_alert_days,
            created_at: user.organization.created_at,
        },
    });
});
// POST /api/auth/logout
router.post('/logout', auth_1.requireAuth, async (req, res) => {
    if (req.user) {
        await (0, audit_1.createAuditEntry)({
            organizationId: req.user.organizationId,
            actor: req.user.email,
            action: 'auth.logout',
            targetType: 'user',
            targetId: req.user.userId,
            targetLabel: req.user.email,
            oldValue: {},
            newValue: {},
            ipAddress: (0, audit_1.getClientIp)(req),
            userAgent: req.headers['user-agent'] ?? '',
        });
    }
    res.json({ message: 'Logged out successfully' });
});
// GET /api/auth/me
router.get('/me', auth_1.requireAuth, async (req, res) => {
    const user = await client_1.default.userApp.findUnique({
        where: { id: req.user.userId },
        include: { organization: true },
    });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json({
        user: {
            id: user.id,
            organization_id: user.organization_id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
        },
        organization: {
            id: user.organization.id,
            name: user.organization.name,
            logo_url: user.organization.logo_url,
            plan: user.organization.plan,
            max_admin_per_platform: user.organization.max_admin_per_platform,
            access_review_delay_days: user.organization.access_review_delay_days,
            subscription_alert_days: user.organization.subscription_alert_days,
            created_at: user.organization.created_at,
        },
    });
});
exports.default = router;
//# sourceMappingURL=auth.js.map