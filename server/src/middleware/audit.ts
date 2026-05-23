import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { v4 as uuidv4 } from 'uuid';

export async function createAuditEntry(params: {
  organizationId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditTrail.create({
    data: {
      id: uuidv4(),
      organization_id: params.organizationId,
      actor: params.actor,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      target_label: params.targetLabel,
      old_value: (params.oldValue ?? {}) as object,
      new_value: (params.newValue ?? {}) as object,
      ip_address: params.ipAddress ?? '',
      user_agent: params.userAgent ?? '',
    },
  });
}

export function getClientIp(req: Request): string {
  // En production derrière un reverse proxy (Railway/Nginx), on fait confiance au premier IP de X-Forwarded-For
  // On valide le format pour éviter l'injection de valeurs arbitraires dans l'audit trail
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const ip = forwarded.split(',')[0].trim();
    // Valider que c'est bien une IP (IPv4 ou IPv6)
    if (/^[\d.:a-fA-F]+$/.test(ip)) return ip;
  }
  return req.socket?.remoteAddress ?? '0.0.0.0';
}
