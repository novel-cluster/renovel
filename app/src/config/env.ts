/**
 * Application environment.
 *
 * Bun auto-loads `.env`. Keep all `process.env` access behind this module so the
 * rest of the app depends on a typed object rather than raw strings.
 */

const DEFAULT_DATABASE_URL = 'postgres://renovel:renovel@localhost:5432/renovel'

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
} as const

export type Env = typeof env
