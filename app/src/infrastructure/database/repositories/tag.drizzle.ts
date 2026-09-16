import { eq } from 'drizzle-orm'
import type { TagRepository } from '@/domain/discovery/discovery'
import { db } from '@/infrastructure/database/drizzle/client'
import { novelTags, tags } from '@/infrastructure/database/schema'

export class DrizzleTagRepository implements TagRepository {
  async setNovelTags(novelId: string, names: string[]): Promise<void> {
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 10)
    await db.transaction(async (tx) => {
      await tx.delete(novelTags).where(eq(novelTags.novelId, novelId))
      for (const name of unique) {
        const [tag] = await tx
          .insert(tags)
          .values({ name })
          .onConflictDoUpdate({ target: tags.name, set: { name } })
          .returning({ id: tags.id })
        await tx.insert(novelTags).values({ novelId, tagId: tag.id }).onConflictDoNothing()
      }
    })
  }

  async listNovelTags(novelId: string): Promise<string[]> {
    const rows = await db
      .select({ name: tags.name })
      .from(novelTags)
      .innerJoin(tags, eq(novelTags.tagId, tags.id))
      .where(eq(novelTags.novelId, novelId))
    return rows.map((r) => r.name)
  }
}
