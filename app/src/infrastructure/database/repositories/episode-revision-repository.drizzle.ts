import { desc, eq, sql } from 'drizzle-orm'
import type {
  EpisodeRevisionRepository,
  NewRevision,
  RevisionSummary,
} from '@/domain/writing/repositories/episode-revision-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { episodeRevisions } from '@/infrastructure/database/schema'

const SUMMARY = {
  id: episodeRevisions.id,
  revisionNo: episodeRevisions.revisionNo,
  title: episodeRevisions.title,
  charCount: episodeRevisions.charCount,
  editorId: episodeRevisions.editorId,
  createdAt: episodeRevisions.createdAt,
}

export class DrizzleEpisodeRevisionRepository implements EpisodeRevisionRepository {
  async nextRevisionNo(episodeId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`coalesce(max(${episodeRevisions.revisionNo}), 0)` })
      .from(episodeRevisions)
      .where(eq(episodeRevisions.episodeId, episodeId))
    return Number(row?.n ?? 0) + 1
  }

  async create(input: NewRevision): Promise<RevisionSummary> {
    const [row] = await db
      .insert(episodeRevisions)
      .values({
        episodeId: input.episodeId,
        editorId: input.editorId,
        revisionNo: input.revisionNo,
        title: input.title,
        body: input.body,
        charCount: input.charCount,
        changeNote: input.changeNote ?? null,
        restoredFromId: input.restoredFromId ?? null,
      })
      .returning(SUMMARY)
    return row
  }

  async listByEpisode(episodeId: string): Promise<RevisionSummary[]> {
    return db
      .select(SUMMARY)
      .from(episodeRevisions)
      .where(eq(episodeRevisions.episodeId, episodeId))
      .orderBy(desc(episodeRevisions.revisionNo))
  }
}
