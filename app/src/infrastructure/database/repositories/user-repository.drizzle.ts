import { and, eq, isNull, sql } from 'drizzle-orm'
import type { User } from '@/domain/identity/entities/user'
import type {
  NewUser,
  ProfileUpdate,
  UserCredentials,
  UserRepository,
} from '@/domain/identity/repositories/user-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { users } from '@/infrastructure/database/schema'

type Row = typeof users.$inferSelect

function toUser(row: Row): User {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    iconUrl: row.iconUrl,
    bio: row.bio,
    externalLinks: row.externalLinks,
    email: row.email,
    status: row.status,
    createdAt: row.createdAt,
  }
}

/** Drizzle-backed {@link UserRepository}. Live-user lookups exclude soft-deletes. */
export class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)
    return row ? toUser(row) : null
  }

  async findByHandle(handle: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.handle, handle), isNull(users.deletedAt)))
      .limit(1)
    return row ? toUser(row) : null
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const [row] = await db
      .select({ id: users.id, status: users.status, passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)
    return row ?? null
  }

  async handleExists(handle: string): Promise<boolean> {
    // `handle` is globally UNIQUE (incl. soft-deleted rows), so do not filter.
    const [row] = await db
      .select({ one: sql`1` })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1)
    return row !== undefined
  }

  async emailExists(email: string): Promise<boolean> {
    const [row] = await db
      .select({ one: sql`1` })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)
    return row !== undefined
  }

  async create(input: NewUser): Promise<User> {
    const [row] = await db
      .insert(users)
      .values({
        handle: input.handle,
        displayName: input.displayName,
        email: input.email,
        passwordHash: input.passwordHash,
      })
      .returning()
    return toUser(row)
  }

  async updateProfile(id: string, patch: ProfileUpdate): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning()
    return toUser(row)
  }
}
