import { and, eq, gt, isNull, lt, ne } from 'drizzle-orm'
import type {
  AuthenticatedSession,
  NewSession,
  SessionRecord,
  SessionRepository,
} from '@/domain/identity/repositories/session-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { sessions, users } from '@/infrastructure/database/schema'

/** Drizzle-backed {@link SessionRepository} (auth.md §1.4). */
export class DrizzleSessionRepository implements SessionRepository {
  async create(input: NewSession): Promise<SessionRecord> {
    const [row] = await db
      .insert(sessions)
      .values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      })
      .returning({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
    return row
  }

  async findAuthenticated(tokenHash: string): Promise<AuthenticatedSession | null> {
    const [row] = await db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        handle: users.handle,
        displayName: users.displayName,
        status: users.status,
        isAdmin: users.isAdmin,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
          isNull(users.deletedAt),
          ne(users.status, 'banned'),
        ),
      )
      .limit(1)

    if (!row) return null
    return {
      session: { id: row.sessionId, userId: row.userId, expiresAt: row.expiresAt },
      user: {
        id: row.userId,
        handle: row.handle,
        displayName: row.displayName,
        status: row.status,
        isAdmin: row.isAdmin,
      },
    }
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  }

  async deleteByUserId(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId))
  }

  async deleteExpired(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  }
}
