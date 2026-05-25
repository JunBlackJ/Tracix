import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  // JWT_SECRET_CURRENT is the active signing key; JWT_SECRET_PREVIOUS is accepted during rotation.
  // JWT_SECRET kept for backward compat with existing deployments.
  jwtSecret: process.env.JWT_SECRET_CURRENT || process.env.JWT_SECRET || 'changeme-use-a-real-secret-in-production',
  jwtSecretPrevious: process.env.JWT_SECRET_PREVIOUS || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `Tracix <${process.env.SMTP_USER}>` : 'Tracix <noreply@tracix.io>'),
  },
};
