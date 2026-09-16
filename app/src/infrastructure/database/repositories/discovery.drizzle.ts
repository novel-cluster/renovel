import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type {
  DiscoveryRepository,
  NovelCard,
  RankingParams,
  SearchParams,
} from '@/domain/discovery/discovery'
import { db } from '@/infrastructure/database/drizzle/client'
import { novels, novelTags, tags, users } from '@/infrastructure/database/schema'

const CARD = {
  slug: novels.slug,
  title: novels.title,
  catchphrase: novels.catchphrase,
  authorHandle: users.handle,
  authorName: users.displayName,
  genre: novels.genre,
  publicationStatus: novels.publicationStatus,
  likeCount: novels.likeCount,
  starAvg: novels.starAvg,
  starCount: novels.starCount,
  followCount: novels.followCount,
  publishedAt: novels.publishedAt,
}

type CardRow = {
  slug: string
  title: string
  catchphrase: string | null
  authorHandle: string
  authorName: string
  genre: NovelCard['genre']
  publicationStatus: NovelCard['publicationStatus']
  likeCount: number
  starAvg: string
  starCount: number
  followCount: number
  publishedAt: Date | null
}

function toCard(r: CardRow): NovelCard {
  return { ...r, starAvg: Number(r.starAvg) }
}

// Discovery only ever surfaces public, visible, live novels (discovery.md §1).
const publicOnly = () =>
  and(eq(novels.visibility, 'public'), eq(novels.contentState, 'visible'), isNull(novels.deletedAt))

function windowStart(window: RankingParams['window']): Date | null {
  const days = window === 'day' ? 1 : window === 'week' ? 7 : window === 'month' ? 30 : null
  if (days === null) return null
  return new Date(Date.now() - days * 86_400_000)
}

export class DrizzleDiscoveryRepository implements DiscoveryRepository {
  async search(params: SearchParams): Promise<NovelCard[]> {
    const conds = [publicOnly()]

    if (params.q?.trim()) {
      const like = `%${params.q.trim()}%`
      const taggedNovelIds = db
        .select({ id: novelTags.novelId })
        .from(novelTags)
        .innerJoin(tags, eq(novelTags.tagId, tags.id))
        .where(ilike(tags.name, like))
      conds.push(
        or(
          ilike(novels.title, like),
          ilike(novels.catchphrase, like),
          ilike(novels.description, like),
          ilike(users.handle, like),
          ilike(users.displayName, like),
          inArray(novels.id, taggedNovelIds),
        ),
      )
    }
    if (params.genre) conds.push(eq(novels.genre, params.genre))
    if (params.status) conds.push(eq(novels.publicationStatus, params.status))
    if (params.tag?.trim()) {
      const taggedNovelIds = db
        .select({ id: novelTags.novelId })
        .from(novelTags)
        .innerJoin(tags, eq(novelTags.tagId, tags.id))
        .where(eq(tags.name, params.tag.trim()))
      conds.push(inArray(novels.id, taggedNovelIds))
    }

    const order =
      params.sort === 'likes'
        ? desc(novels.likeCount)
        : params.sort === 'stars'
          ? desc(novels.starAvg)
          : desc(novels.publishedAt)

    const rows = await db
      .select(CARD)
      .from(novels)
      .innerJoin(users, eq(novels.authorId, users.id))
      .where(and(...conds))
      .orderBy(order)
      .limit(params.limit)
    return rows.map(toCard)
  }

  async rankingCandidates(params: RankingParams): Promise<NovelCard[]> {
    const conds = [publicOnly()]
    const start = windowStart(params.window)
    if (start) conds.push(gte(novels.publishedAt, start))
    if (params.onlyCompleted) conds.push(eq(novels.publicationStatus, 'completed'))

    const rows = await db
      .select(CARD)
      .from(novels)
      .innerJoin(users, eq(novels.authorId, users.id))
      .where(and(...conds))
      // Rough pre-filter; the app re-sorts by the pure ranking score.
      .orderBy(desc(sql`${novels.likeCount} + ${novels.starCount} + ${novels.followCount}`))
      .limit(300)
    return rows.map(toCard)
  }

  async newest(limit: number): Promise<NovelCard[]> {
    const rows = await db
      .select(CARD)
      .from(novels)
      .innerJoin(users, eq(novels.authorId, users.id))
      .where(and(publicOnly(), sql`${novels.publishedAt} is not null`))
      .orderBy(desc(novels.publishedAt))
      .limit(limit)
    return rows.map(toCard)
  }

  async popular(excludeAuthorId: string | null, limit: number): Promise<NovelCard[]> {
    const conds = [publicOnly()]
    if (excludeAuthorId) conds.push(sql`${novels.authorId} <> ${excludeAuthorId}`)
    const rows = await db
      .select(CARD)
      .from(novels)
      .innerJoin(users, eq(novels.authorId, users.id))
      .where(and(...conds))
      .orderBy(desc(sql`${novels.likeCount} + ${novels.starCount} * 2 + ${novels.followCount} * 3`))
      .limit(limit)
    return rows.map(toCard)
  }
}
