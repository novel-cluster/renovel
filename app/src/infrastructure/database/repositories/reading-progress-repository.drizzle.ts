import { and, desc, eq, sql } from 'drizzle-orm'
import type {
  ReadingProgressRepository,
  RecordProgressInput,
} from '@/domain/reading/repositories/reading-progress-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { episodes, readingProgress } from '@/infrastructure/database/schema'

export class DrizzleReadingProgressRepository implements ReadingProgressRepository {
  async record(input: RecordProgressInput): Promise<void> {
    const now = new Date()
    await db
      .insert(readingProgress)
      .values({
        userId: input.userId,
        novelId: input.novelId,
        episodeId: input.episodeId,
        position: input.position ?? 0,
        isCompleted: input.isCompleted ?? false,
        lastReadAt: now,
      })
      .onConflictDoUpdate({
        target: [readingProgress.userId, readingProgress.episodeId],
        set: {
          lastReadAt: now,
          updatedAt: now,
          // Keep the existing value when the caller did not supply one.
          position: input.position ?? sql`${readingProgress.position}`,
          isCompleted: input.isCompleted ?? sql`${readingProgress.isCompleted}`,
        },
      })
  }

  async latestEpisodeNoForNovel(userId: string, novelId: string): Promise<number | null> {
    const [row] = await db
      .select({ no: episodes.episodeNo })
      .from(readingProgress)
      .innerJoin(episodes, eq(readingProgress.episodeId, episodes.id))
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, novelId)))
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(1)
    return row ? row.no : null
  }
}
