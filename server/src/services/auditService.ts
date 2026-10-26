import { AuditLog } from '../models/AuditLog.js';
import type { Types } from 'mongoose';

export async function logAudit(params: {
  actorId: Types.ObjectId | string;
  action: string;
  resourceType: string;
  resourceId?: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await AuditLog.create({
    actor: params.actorId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    ip: params.ip,
  });
}
