import { eq } from 'drizzle-orm'
import type { ForkAttribution, ForkRepository } from '@/domain/fork/fork'
import { db } from '@/infrastructure/database/drizzle/client'
import { forks, novels, users } from '@/infrastructure/database/schema'

export class DrizzleForkRepository implements ForkRepository {
  async create(input: {
    sourceNovelId: string
    forkedNovelId: string
    forkedBy: string
    rootNovelId: string
  }): Promise<void> {
    await db.insert(forks).values({
      sourceNovelId: input.sourceNovelId,
      forkedNovelId: input.forkedNovelId,
      forkedBy: input.forkedBy,
      rootNovelId: input.rootNovelId,
    })
  }

  async attributionFor(novelId: string): Promise<ForkAttribution | null> {
    const [row] = await db
      .select({
        sourceNovelId: forks.sourceNovelId,
        sourceSlug: novels.slug,
        sourceTitle: novels.title,
        sourceAuthorHandle: users.handle,
        sourceAuthorName: users.displayName,
      })
      .from(forks)
      .innerJoin(novels, eq(forks.sourceNovelId, novels.id))
      .innerJoin(users, eq(novels.authorId, users.id))
      .where(eq(forks.forkedNovelId, novelId))
      .limit(1)
    return row ?? null
  }
}
