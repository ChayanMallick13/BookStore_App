import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(255),
  otp: z.string().regex(/^\d{6}$/),
});

export const resendEmailVerificationSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});
