import type {
  ContentState,
  ForkPolicy,
  Genre,
  Novel,
  PublicationStatus,
  Visibility,
} from '../entities/novel'

export interface NewNovel {
  slug: string
  authorId: string
  title: string
}

export interface NovelUpdate {
  title?: string
  catchphrase?: string | null
  description?: string | null
  genre?: Genre | null
  visibility?: Visibility
  publicationStatus?: PublicationStatus
  contentState?: ContentState
  contentWarnings?: string[]
  forkPolicy?: ForkPolicy
  publishedAt?: Date | null
}

/** Novel persistence port. Lookups exclude soft-deleted novels. */
export interface NovelRepository {
  findById(id: string): Promise<Novel | null>
  findBySlug(slug: string): Promise<Novel | null>
  listByAuthor(authorId: string): Promise<Novel[]>
  slugExists(slug: string): Promise<boolean>
  create(input: NewNovel): Promise<Novel>
  update(id: string, patch: NovelUpdate): Promise<Novel>
  /** Adjusts the denormalized `total_char_count` by a delta (data-model.md §novel). */
  addTotalCharCount(id: string, delta: number): Promise<void>
  // Denormalized social counters, updated from the social domain (Phase 4).
  addLikeCount(id: string, delta: number): Promise<void>
  setStarAggregate(id: string, avg: number, count: number): Promise<void>
  addFollowCount(id: string, delta: number): Promise<void>
}
