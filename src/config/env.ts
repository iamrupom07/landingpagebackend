import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  PORT:               z.string().default('5000'),
  DATABASE_URL:       z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET:         z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN:     z.string().default('7d'),
  CORS_ORIGINS:       z.string().default('http://localhost:3000'),
  SMTP_HOST:          z.string().optional(),
  SMTP_PORT:          z.string().optional(),
  SMTP_USER:          z.string().optional(),
  SMTP_PASS:          z.string().optional(),
  SMTP_FROM:          z.string().optional(),
  NOTIFICATION_EMAIL: z.string().email().optional(),
  ADMIN_EMAIL:        z.string().email().optional(),
  ADMIN_PASSWORD:     z.string().optional(),
  ADMIN_NAME:         z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins: string[] = env.CORS_ORIGINS
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
