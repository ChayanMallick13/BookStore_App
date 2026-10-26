import mongoose, { Schema, type Document } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: 1000, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
