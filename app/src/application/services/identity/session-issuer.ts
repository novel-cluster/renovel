import type { SessionRepository } from '@/domain/identity/repositories/session-repository'
import { generateSessionToken, hashToken } from '@/shared/utils/token'

/** Default session lifetime — "remember me" by default (auth.md §1.4). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface IssuedSession {
  token: string
  expiresAt: Date
}

/**
 * Mints a session: random token to the caller (cookie), only its hash to the DB.
 * Shared by signup and login.
 */
export async function issueSession(
  sessions: SessionRepository,
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<IssuedSession> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await sessions.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null,
  })
  return { token, expiresAt }
}
