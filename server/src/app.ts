import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/error';

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
import riskSnapshotsRoutes from './routes/risk-snapshots';
import connectorsRoutes from './routes/connectors';
import webhooksRoutes from './routes/webhooks';
import apiKeysRoutes, { scimRouter } from './routes/api-keys';
import paymentsRoutes from './routes/payments';
import fedapayRoutes from './routes/fedapay';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = [config.frontendUrl, config.frontendUrl.replace('://', '://admin.')];
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origine non autorisée — ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

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
app.use('/api/risk-snapshots', riskSnapshotsRoutes);
app.use('/api/connectors', connectorsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/scim', scimRouter);
app.use('/api/payments', paymentsRoutes);
app.use('/api/fedapay', fedapayRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

export default app;
