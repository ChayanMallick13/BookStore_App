import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  CLIENT_URL: z.string().url().transform((value) => new URL(value).origin),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).optional(),
  EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default('Books Bin <noreply@booksbin.local>'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().default(999),
  SHIPPING_FLAT_RATE: z.coerce.number().default(49),
  COD_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  UPLOAD_MAX_MB: z.coerce.number().default(5),
}).superRefine((values, ctx) => {
  const cloudinaryValues = [
    values.CLOUDINARY_CLOUD_NAME,
    values.CLOUDINARY_API_KEY,
    values.CLOUDINARY_API_SECRET,
  ];
  if (cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLOUDINARY_API_SECRET'],
      message: 'Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together',
    });
  }
  if (values.NODE_ENV === 'production' && !cloudinaryValues.every(Boolean)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLOUDINARY_CLOUD_NAME'],
      message: 'Cloudinary credentials are required in production for book image uploads',
    });
  }
  if (values.NODE_ENV !== 'production') return;

  if (values.EMAIL_PROVIDER === 'resend' && !values.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
    });
  }
  if (values.EMAIL_PROVIDER === 'smtp' && !values.SMTP_HOST) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SMTP_HOST'],
      message: 'SMTP_HOST is required when EMAIL_PROVIDER=smtp in production',
    });
  }
  if (values.EMAIL_PROVIDER === 'smtp' && Boolean(values.SMTP_USER) !== Boolean(values.SMTP_PASS)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SMTP_PASS'],
      message: 'SMTP_USER and SMTP_PASS must be configured together',
    });
  }
  if (
    !process.env.EMAIL_FROM?.trim() ||
    /@[^>]*\.local(?:>|$)|@example\.com(?:>|$)/i.test(values.EMAIL_FROM)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['EMAIL_FROM'],
      message: 'Set EMAIL_FROM to a real sender address accepted by the selected email provider',
    });
  }
});

type ParsedEnv = z.infer<typeof envSchema>;
export type Env = Omit<ParsedEnv, 'COOKIE_SAME_SITE'> & {
  COOKIE_SAME_SITE: 'strict' | 'lax' | 'none';
};

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Environment validation failed');
    }
    const fallback = envSchema.parse({
      ...process.env,
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/bookhaven_test',
      CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-characters!!',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-characters!',
    });
    return {
      ...fallback,
      COOKIE_SAME_SITE: fallback.COOKIE_SAME_SITE ?? 'lax',
    };
  }
  return {
    ...parsed.data,
    COOKIE_SAME_SITE:
      parsed.data.COOKIE_SAME_SITE ??
      (parsed.data.NODE_ENV === 'production' ? 'none' : 'lax'),
  };
}

export const env = loadEnv();
