import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  CLIENT_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('BookHaven <noreply@bookhaven.local>'),
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
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Environment validation failed');
    }
    return envSchema.parse({
      ...process.env,
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/bookhaven_test',
      CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-characters!!',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-characters!',
    });
  }
  return parsed.data;
}

export const env = loadEnv();
