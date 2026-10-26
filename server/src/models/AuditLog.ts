import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAuditLog extends Document {
  actor: Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditSchema);
