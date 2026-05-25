import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

// In-memory permission cache: "role:orgId" → Set<permKey>, TTL 5 min
const cache = new Map<string, { perms: Set<string>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getPermissionsForRole(roleName: string): Promise<Set<string>> {
  const cacheKey = `role:${roleName}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.perms;

  const role = await (prisma as any).role.findUnique({
    where: { name: roleName },
    include: { rolePermissions: { include: { permission: true } } },
  });

  const perms = new Set<string>(
    role ? role.rolePermissions.map((rp: { permission: { key: string } }) => rp.permission.key) : [],
  );
  cache.set(cacheKey, { perms, expiresAt: Date.now() + CACHE_TTL_MS });
  return perms;
}

// Invalidate the in-memory cache for a given role (call after updating role_permissions).
export function invalidateRoleCache(roleName: string) {
  cache.delete(`role:${roleName}`);
}

// requirePermission('members.write') returns a middleware that:
// 1. Reads req.user.role (from JWT)
// 2. Looks up permissions from the RBAC tables (with 5-min cache)
// 3. Falls back gracefully: if the role table is empty (fresh deploy), admin passes everything
export function requirePermission(permKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const roleName = req.user.role;
    const perms = await getPermissionsForRole(roleName);

    // Graceful fallback: if RBAC tables are empty (not yet seeded), allow admin/owner through
    if (perms.size === 0 && (roleName === 'admin' || roleName === 'owner')) {
      next();
      return;
    }

    if (!perms.has(permKey)) {
      res.status(403).json({
        error: 'Permission insuffisante',
        required: permKey,
        role: roleName,
      });
      return;
    }

    next();
  };
}
