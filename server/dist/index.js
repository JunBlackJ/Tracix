"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const error_1 = require("./middleware/error");
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const members_1 = __importDefault(require("./routes/members"));
const platforms_1 = __importDefault(require("./routes/platforms"));
const access_1 = __importDefault(require("./routes/access"));
const systems_1 = __importDefault(require("./routes/systems"));
const flows_1 = __importDefault(require("./routes/flows"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const audit_1 = __importDefault(require("./routes/audit"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const import_1 = __importDefault(require("./routes/import"));
const app = (0, express_1.default)();
// ─── Middleware ───
app.use((0, cors_1.default)({
    origin: config_1.config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Health check ───
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});
// ─── API Routes ───
app.use('/api/auth', auth_1.default);
app.use('/api/members', members_1.default);
app.use('/api/platforms', platforms_1.default);
app.use('/api/access-rights', access_1.default);
app.use('/api/systems', systems_1.default);
app.use('/api/network-flows', flows_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
app.use('/api/alerts', alerts_1.default);
app.use('/api/audit-trail', audit_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/import', import_1.default);
// ─── 404 handler ───
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// ─── Global error handler ───
app.use(error_1.errorHandler);
// ─── Start server ───
app.listen(config_1.config.port, () => {
    console.log(`[Tracix API] Server running on http://localhost:${config_1.config.port}`);
    console.log(`[Tracix API] Environment: ${config_1.config.nodeEnv}`);
    console.log(`[Tracix API] Frontend allowed: ${config_1.config.frontendUrl}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map