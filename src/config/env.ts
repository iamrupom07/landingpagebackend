import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z
  .object({
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  PORT:               z.string().default('5000'),
  DATABASE_URL:       z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET:         z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN:     z.string().default('1h'),
  CORS_ORIGINS:       z.string().default('http://localhost:3000'),
  REDIS_URL:          z.preprocess(emptyToUndefined, z.string().url().optional()),
  ADMIN_APP_URL:      z.string().url().default('http://localhost:3000'),
  MAX_EXPORT_ROWS:    z.coerce.number().int().positive().max(500_000).default(50_000),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(30),
  SMTP_HOST:          z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT:          z.preprocess(emptyToUndefined, z.string().default('587')),
  SMTP_USER:          z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS:          z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_FROM:          z.preprocess(emptyToUndefined, z.string().optional()),
  NOTIFICATION_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  ADMIN_EMAIL:        z.preprocess(emptyToUndefined, z.string().email().optional()),
  ADMIN_PASSWORD:     z.preprocess(emptyToUndefined, z.string().optional()),
  ADMIN_NAME:         z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && !value.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      });
    }

    const smtpFields = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const;
    const configuredFields = smtpFields.filter((key) => Boolean(value[key]));
    if (configuredFields.length > 0 && configuredFields.length < smtpFields.length) {
      for (const key of smtpFields) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'SMTP_HOST, SMTP_USER, and SMTP_PASS must be set together',
          });
        }
      }
    }
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
