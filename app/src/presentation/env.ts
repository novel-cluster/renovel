import type { AuthUserRecord } from '@/domain/identity/repositories/session-repository'

/**
 * Hono context typing (auth.md §2.1). The auth middleware puts the current user
 * and session here (both `null` for guests); controllers read them via
 * `c.get(...)` and pass only primitives to application services.
 */
export type AuthUser = AuthUserRecord

export interface AuthSession {
  id: string
  expiresAt: Date
}

export interface AppEnv {
  Variables: {
    user: AuthUser | null
    session: AuthSession | null
  }
}
