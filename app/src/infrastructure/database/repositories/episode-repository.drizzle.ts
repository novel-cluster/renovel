import { and, asc, eq, sql } from 'drizzle-orm'
import type { Episode, EpisodeSummary } from '@/domain/novel/entities/episode'
import type {
  EpisodeRepository,
  EpisodeUpdate,
  NewEpisode,
} from '@/domain/novel/repositories/episode-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { episodes } from '@/infrastructure/database/schema'

type Row = typeof episodes.$inferSelect

function toEpisode(row: Row): Episode {
  return {
    id: row.id,
    novelId: row.novelId,
    chapterId: row.chapterId,
    episodeNo: row.episodeNo,
    orderIndex: row.orderIndex,
    title: row.title,
    body: row.body,
    charCount: row.charCount,
    status: row.status,
    visibility: row.visibility,
    contentState: row.contentState,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const SUMMARY = {
  id: episodes.id,
  episodeNo: episodes.episodeNo,
  title: episodes.title,
  status: episodes.status,
  charCount: episodes.charCount,
  publishedAt: episodes.publishedAt,
}

export class DrizzleEpisodeRepository implements EpisodeRepository {
  async findById(id: string): Promise<Episode | null> {
    const [row] = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1)
    return row ? toEpisode(row) : null
  }

  async findByNovelAndNo(novelId: string, episodeNo: number): Promise<Episode | null> {
    const [row] = await db
      .select()
      .from(episodes)
      .where(and(eq(episodes.novelId, novelId), eq(episodes.episodeNo, episodeNo)))
      .limit(1)
    return row ? toEpisode(row) : null
  }

  async listByNovel(novelId: string): Promise<EpisodeSummary[]> {
    return db
      .select(SUMMARY)
      .from(episodes)
      .where(eq(episodes.novelId, novelId))
      .orderBy(asc(episodes.orderIndex))
  }

  async listPublishedByNovel(novelId: string): Promise<EpisodeSummary[]> {
    return db
      .select(SUMMARY)
      .from(episodes)
      .where(and(eq(episodes.novelId, novelId), eq(episodes.status, 'published')))
      .orderBy(asc(episodes.orderIndex))
  }

  async nextEpisodeNo(novelId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`coalesce(max(${episodes.episodeNo}), 0)` })
      .from(episodes)
      .where(eq(episodes.novelId, novelId))
    return Number(row?.n ?? 0) + 1
  }

  async create(input: NewEpisode): Promise<Episode> {
    const [row] = await db
      .insert(episodes)
      .values({
        novelId: input.novelId,
        episodeNo: input.episodeNo,
        orderIndex: input.orderIndex,
        title: input.title,
        body: input.body,
        charCount: input.charCount,
      })
      .returning()
    return toEpisode(row)
  }

  async update(id: string, patch: EpisodeUpdate): Promise<Episode> {
    const [row] = await db
      .update(episodes)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(episodes.id, id))
      .returning()
    return toEpisode(row)
  }
}
