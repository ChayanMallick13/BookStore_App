import { Schema } from 'mongoose';

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  resourceType: CloudinaryResourceType;
  format?: string;
  width?: number;
  height?: number;
}

export const cloudinaryAssetSchema = new Schema<CloudinaryAsset>(
  {
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
    format: String,
    width: Number,
    height: Number,
  },
  { _id: false },
);
