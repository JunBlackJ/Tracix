import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const user = await prisma.userApp.findUnique({ where: { id: req.user.userId }, select: { is_superadmin: true } });
  if (!user?.is_superadmin) { res.status(403).json({ error: 'Super-admin access required' }); return; }
  next();
}
