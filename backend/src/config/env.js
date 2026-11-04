import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration, validated once at startup.
 * Fails fast in production when a secret is missing or weak.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URL: z.string().min(1).default('mongodb://localhost:27017/inclusivenue'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev-only-secret-change-me-please'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(2),
  // Mail: "smtp" sends real emails, "log" stores them in the dev outbox (no email is sent).
  MAIL_MODE: z.enum(['smtp', 'log']).default('log'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('InclusiVenue <no-reply@inclusivenue.local>'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  REMINDER_INTERVAL_MINUTES: z.coerce.number().int().nonnegative().default(15),
  SEED_ON_START: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.startsWith('dev-only') || env.JWT_SECRET.length < 32) {
    console.error('In production JWT_SECRET must be set to a random value of at least 32 characters.');
    process.exit(1);
  }
  if (env.MAIL_MODE === 'smtp' && !env.SMTP_HOST) {
    console.error('MAIL_MODE=smtp requires SMTP_HOST.');
    process.exit(1);
  }
}

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
