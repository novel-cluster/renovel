import { and, desc, eq, isNull } from 'drizzle-orm'
import type { LibraryItem, LibraryState } from '@/domain/reading/entities/reading'
import type { LibraryRepository } from '@/domain/reading/repositories/library-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { libraryEntries, novels, users } from '@/infrastructure/database/schema'

export class DrizzleLibraryRepository implements LibraryRepository {
  async setState(userId: string, novelId: string, state: LibraryState): Promise<void> {
    const now = new Date()
    await db
      .insert(libraryEntries)
      .values({ userId, novelId, state })
      .onConflictDoUpdate({
        target: [libraryEntries.userId, libraryEntries.novelId],
        set: { state, updatedAt: now },
      })
  }

  async remove(userId: string, novelId: string): Promise<void> {
    await db
      .delete(libraryEntries)
      .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.novelId, novelId)))
  }

  async find(userId: string, novelId: string): Promise<LibraryState | null> {
    const [row] = await db
      .select({ state: libraryEntries.state })
      .from(libraryEntries)
      .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.novelId, novelId)))
      .limit(1)
    return row?.state ?? null
  }

  async listByUser(userId: string): Promise<LibraryItem[]> {
    return db
      .select({
        novelId: novels.id,
        slug: novels.slug,
        title: novels.title,
        authorHandle: users.handle,
        state: libraryEntries.state,
      })
      .from(libraryEntries)
      .innerJoin(novels, eq(libraryEntries.novelId, novels.id))
      .innerJoin(users, eq(novels.authorId, users.id))
      .where(and(eq(libraryEntries.userId, userId), isNull(novels.deletedAt)))
      .orderBy(desc(libraryEntries.updatedAt))
  }
}
