import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { startCronJobs } from './services/cron.service';

// Routes
import authRoutes from './routes/auth';
import membersRoutes from './routes/members';
import platformsRoutes from './routes/platforms';
import accessRoutes from './routes/access';
import systemsRoutes from './routes/systems';
import flowsRoutes from './routes/flows';
import subscriptionsRoutes from './routes/subscriptions';
import alertsRoutes from './routes/alerts';
import auditRoutes from './routes/audit';
import dashboardRoutes from './routes/dashboard';
import importRoutes from './routes/import';
import categoriesRoutes from './routes/categories';
import customModulesRoutes from './routes/custom-modules';
import organizationsRoutes from './routes/organizations';
import invitationsRoutes from './routes/invitations';
import reviewsRoutes from './routes/reviews';
import reportsRoutes from './routes/reports';
import samlRoutes from './routes/saml';
import adminRoutes from './routes/admin';

const app = express();

// ─── Sécurité HTTP ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // géré côté frontend (Vite)
}));

// ─── CORS ───
app.use(cors({
  origin: (origin, cb) => {
    // Autoriser: frontendUrl configuré, sous-domaines admin.*, et pas d'origin (curl, Postman)
    if (!origin) return cb(null, true);
    const allowed = [config.frontendUrl, config.frontendUrl.replace('://', '://admin.')];
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origine non autorisée — ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate limiting global ───
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' },
});

// ─── Rate limiting strict sur les endpoints sensibles ───
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Health check ───
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/platforms', platformsRoutes);
app.use('/api/access-rights', accessRoutes);
app.use('/api/systems', systemsRoutes);
app.use('/api/network-flows', flowsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/audit-trail', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/custom-modules', customModulesRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/saml', samlRoutes);
app.use('/api/admin', adminRoutes);

// ─── 404 handler ───
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ───
app.use(errorHandler);

// ─── Start server ───
app.listen(config.port, () => {
  console.log(`[Tracix API] Server running on http://localhost:${config.port}`);
  console.log(`[Tracix API] Environment: ${config.nodeEnv}`);
  console.log(`[Tracix API] Frontend allowed: ${config.frontendUrl}`);
  startCronJobs();
});

export default app;
