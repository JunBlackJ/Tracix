import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface SuperAdminJwt {
  superadmin: true;
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  const secrets = [config.jwtSecret, config.jwtSecretPrevious].filter(Boolean);
  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), secret) as SuperAdminJwt;
      if (!decoded.superadmin) throw new Error();
      next();
      return;
    } catch {
      // try next key
    }
  }
  res.status(403).json({ error: 'Accès réservé aux super-admins' });
}

export function generateSuperAdminToken(): string {
  return jwt.sign({ superadmin: true }, config.jwtSecret, { expiresIn: '2h', keyid: 'current' });
}
