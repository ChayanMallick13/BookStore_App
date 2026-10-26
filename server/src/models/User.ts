import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type UserRole = 'customer' | 'admin';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationOtp?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  emailVerificationAttempts: number;
  refreshTokenVersion: number;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true },
    emailVerificationOtp: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    emailVerificationSentAt: { type: Date, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    refreshTokenVersion: { type: Number, default: 0 },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', userSchema);

export type UserId = Types.ObjectId;
