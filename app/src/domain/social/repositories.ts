/**
 * social domain persistence ports (data-model.md §social, PRD §20–21).
 * Consolidated into one file: these small aggregates share the same shape and
 * are always wired together.
 */

export interface LikeRepository {
  /** Toggle a like on an episode. Returns the resulting state. */
  toggle(userId: string, episodeId: string): Promise<{ liked: boolean }>
  isLiked(userId: string, episodeId: string): Promise<boolean>
  countForEpisode(episodeId: string): Promise<number>
}

export interface StarRepository {
  /** Upsert the user's 1–3 star for a novel. */
  set(userId: string, novelId: string, value: number): Promise<void>
  get(userId: string, novelId: string): Promise<number | null>
  /** Aggregate (avg, count) for the novel, for the denormalized cache. */
  aggregate(novelId: string): Promise<{ avg: number; count: number }>
}

export interface Review {
  id: string
  userId: string
  authorHandle: string
  authorName: string
  stars: number
  title: string
  body: string
  createdAt: Date
}

export interface ReviewRepository {
  /** Upsert (one live review per user per novel). */
  upsert(input: {
    userId: string
    novelId: string
    stars: number
    title: string
    body: string
  }): Promise<void>
  listForNovel(novelId: string): Promise<Review[]>
  findByUser(userId: string, novelId: string): Promise<Review | null>
}

export interface Comment {
  id: string
  userId: string
  authorHandle: string
  authorName: string
  body: string
  parentId: string | null
  createdAt: Date
  deleted: boolean
}

export interface CommentRepository {
  create(input: {
    episodeId: string
    userId: string
    body: string
    parentId?: string | null
  }): Promise<void>
  listForEpisode(episodeId: string): Promise<Comment[]>
}

export interface FollowRepository {
  toggleUser(followerId: string, followeeId: string): Promise<{ following: boolean }>
  isFollowingUser(followerId: string, followeeId: string): Promise<boolean>
  toggleNovel(userId: string, novelId: string): Promise<{ following: boolean }>
  isFollowingNovel(userId: string, novelId: string): Promise<boolean>
  /** Recipient user IDs for a novel's update fan-out (PRD §22). */
  novelFollowerIds(novelId: string): Promise<string[]>
}
