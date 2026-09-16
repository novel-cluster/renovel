import type { Genre, PublicationStatus } from '@/domain/novel/entities/novel'

/** List-item projection for search / ranking / home (data-model.md §discovery). */
export interface NovelCard {
  slug: string
  title: string
  catchphrase: string | null
  authorHandle: string
  authorName: string
  genre: Genre | null
  publicationStatus: PublicationStatus
  likeCount: number
  starAvg: number
  starCount: number
  followCount: number
  publishedAt: Date | null
}

export type SortKey = 'new' | 'likes' | 'stars'
export type RankingWindow = 'day' | 'week' | 'month' | 'all'

export interface SearchParams {
  q?: string
  genre?: Genre | null
  status?: PublicationStatus | null
  tag?: string | null
  sort: SortKey
  limit: number
}

export interface RankingParams {
  window: RankingWindow
  onlyCompleted?: boolean
  limit: number
}

/**
 * Read-only discovery port (discovery.md §1). Implementations MUST filter to
 * `visibility='public' AND deleted_at IS NULL AND content_state='visible'` —
 * Unlisted/Private never appear here (PRD §9, auth.md).
 */
export interface DiscoveryRepository {
  search(params: SearchParams): Promise<NovelCard[]>
  /** Candidates for ranking within a time window; scored/sorted in the app. */
  rankingCandidates(params: RankingParams): Promise<NovelCard[]>
  newest(limit: number): Promise<NovelCard[]>
  /** Rule-based recommendation seed: popular public novels (optionally excluding an author). */
  popular(excludeAuthorId: string | null, limit: number): Promise<NovelCard[]>
}

/** Novel ↔ tag maintenance (studio) + lookup. */
export interface TagRepository {
  setNovelTags(novelId: string, names: string[]): Promise<void>
  listNovelTags(novelId: string): Promise<string[]>
}

/**
 * Time-decayed weighted ranking score (discovery.md §4.3). Kept pure so it is
 * unit-testable and swappable for an analytics-backed score later.
 */
export function rankingScore(
  n: Pick<NovelCard, 'likeCount' | 'starCount' | 'starAvg' | 'followCount' | 'publishedAt'>,
  now: Date,
): number {
  const base = n.likeCount + n.starCount * n.starAvg * 2 + n.followCount * 3
  const ageDays = n.publishedAt ? (now.getTime() - n.publishedAt.getTime()) / 86_400_000 : 3650
  return base / (ageDays + 2) ** 0.6
}
