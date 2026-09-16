import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Novel } from '@/domain/novel/entities/novel'
import type {
  NewNovel,
  NovelRepository,
  NovelUpdate,
} from '@/domain/novel/repositories/novel-repository'
import { db } from '@/infrastructure/database/drizzle/client'
import { novels } from '@/infrastructure/database/schema'

type Row = typeof novels.$inferSelect

function toNovel(row: Row): Novel {
  return {
    id: row.id,
    slug: row.slug,
    authorId: row.authorId,
    title: row.title,
    catchphrase: row.catchphrase,
    description: row.description,
    genre: row.genre,
    visibility: row.visibility,
    publicationStatus: row.publicationStatus,
    contentState: row.contentState,
    contentWarnings: row.contentWarnings,
    likeCount: row.likeCount,
    starAvg: Number(row.starAvg),
    starCount: row.starCount,
    followCount: row.followCount,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleNovelRepository implements NovelRepository {
  async findById(id: string): Promise<Novel | null> {
    const [row] = await db
      .select()
      .from(novels)
      .where(and(eq(novels.id, id), isNull(novels.deletedAt)))
      .limit(1)
    return row ? toNovel(row) : null
  }

  async findBySlug(slug: string): Promise<Novel | null> {
    const [row] = await db
      .select()
      .from(novels)
      .where(and(eq(novels.slug, slug), isNull(novels.deletedAt)))
      .limit(1)
    return row ? toNovel(row) : null
  }

  async listByAuthor(authorId: string): Promise<Novel[]> {
    const rows = await db
      .select()
      .from(novels)
      .where(and(eq(novels.authorId, authorId), isNull(novels.deletedAt)))
      .orderBy(desc(novels.updatedAt))
    return rows.map(toNovel)
  }

  async slugExists(slug: string): Promise<boolean> {
    // `slug` is globally UNIQUE (incl. soft-deleted rows), so do not filter.
    const [row] = await db
      .select({ one: sql`1` })
      .from(novels)
      .where(eq(novels.slug, slug))
      .limit(1)
    return row !== undefined
  }

  async create(input: NewNovel): Promise<Novel> {
    const [row] = await db
      .insert(novels)
      .values({ slug: input.slug, authorId: input.authorId, title: input.title })
      .returning()
    return toNovel(row)
  }

  async update(id: string, patch: NovelUpdate): Promise<Novel> {
    const [row] = await db
      .update(novels)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(novels.id, id), isNull(novels.deletedAt)))
      .returning()
    return toNovel(row)
  }

  async addTotalCharCount(id: string, delta: number): Promise<void> {
    await db
      .update(novels)
      .set({ totalCharCount: sql`${novels.totalCharCount} + ${delta}`, updatedAt: new Date() })
      .where(eq(novels.id, id))
  }

  async addLikeCount(id: string, delta: number): Promise<void> {
    await db
      .update(novels)
      .set({ likeCount: sql`${novels.likeCount} + ${delta}` })
      .where(eq(novels.id, id))
  }

  async setStarAggregate(id: string, avg: number, count: number): Promise<void> {
    await db
      .update(novels)
      .set({ starAvg: avg.toFixed(2), starCount: count })
      .where(eq(novels.id, id))
  }

  async addFollowCount(id: string, delta: number): Promise<void> {
    await db
      .update(novels)
      .set({ followCount: sql`${novels.followCount} + ${delta}` })
      .where(eq(novels.id, id))
  }
}
