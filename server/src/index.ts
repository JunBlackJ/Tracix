import 'express-async-errors';
import express from 'express';
import cors from 'cors';
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

const app = express();

// ─── Middleware ───
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
