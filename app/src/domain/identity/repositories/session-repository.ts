import type { UserStatus } from '../entities/user'

export interface NewSession {
  userId: string
  tokenHash: string
  expiresAt: Date
  ip?: string | null
  userAgent?: string | null
}

export interface SessionRecord {
  id: string
  userId: string
  expiresAt: Date
}

/** The projection the auth middleware puts on the Hono context (auth.md §2.1). */
export interface AuthUserRecord {
  id: string
  handle: string
  displayName: string
  status: UserStatus
  isAdmin: boolean
}

export interface AuthenticatedSession {
  session: SessionRecord
  user: AuthUserRecord
}

/**
 * Session persistence port (auth.md §1.4). The raw cookie token is never
 * stored; callers pass its SHA-256 hash.
 */
export interface SessionRepository {
  create(input: NewSession): Promise<SessionRecord>
  /** Valid = not expired, user not soft-deleted, user not `banned` (auth.md §1.4). */
  findAuthenticated(tokenHash: string): Promise<AuthenticatedSession | null>
  deleteByTokenHash(tokenHash: string): Promise<void>
  deleteByUserId(userId: string): Promise<void>
  deleteExpired(): Promise<void>
}
