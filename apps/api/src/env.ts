import { z } from 'zod';

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

/**
 * Reduces a configured or requested origin to `scheme://host[:port]`, lower-cased, with no path or trailing slash.
 * Dashboard values often arrive quoted, with a trailing comma or slash, or without a scheme; an origin that fails to
 * match because of that is a silent outage for every browser. A value without a scheme gets https, except loopback
 * hosts, which get http. Returns '' for a value that is not an origin.
 */
export function normalizeOrigin(value: string): string {
  const cleaned = value.replace(/^[\s"'`,;]+|[\s"'`,;]+$/g, '');
  if (!cleaned) return '';
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned);
  const scheme = hasScheme ? '' : LOOPBACK.test(cleaned) ? 'http://' : 'https://';
  try {
    return new URL(scheme + cleaned).origin;
  } catch {
    return '';
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(4100),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3100')
    .transform((value) => value.split(',').map(normalizeOrigin).filter(Boolean))
    .refine((origins) => origins.length > 0, {
      message: 'CORS_ORIGINS has no valid origin, for example https://your-app.vercel.app',
    }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Optional: without both, daily summaries use the template (ARCHITECTURE §12).
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
