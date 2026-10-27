import mongoose, { Schema, type Document } from 'mongoose';
import type { CloudinaryResourceType } from './CloudinaryAsset.js';

export interface ICloudinaryCleanup extends Document {
  publicId: string;
  resourceType: CloudinaryResourceType;
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
}

const cloudinaryCleanupSchema = new Schema<ICloudinaryCleanup>(
  {
    publicId: { type: String, required: true, unique: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, select: false },
  },
  { timestamps: true },
);

export const CloudinaryCleanup = mongoose.model<ICloudinaryCleanup>(
  'CloudinaryCleanup',
  cloudinaryCleanupSchema,
);
