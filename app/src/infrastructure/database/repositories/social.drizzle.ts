import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type {
  Comment,
  CommentRepository,
  FollowRepository,
  LikeRepository,
  Review,
  ReviewRepository,
  StarRepository,
} from '@/domain/social/repositories'
import { db } from '@/infrastructure/database/drizzle/client'
import {
  comments,
  likes,
  novelFollows,
  reviews,
  stars,
  userFollows,
  users,
} from '@/infrastructure/database/schema'

export class DrizzleLikeRepository implements LikeRepository {
  async toggle(userId: string, episodeId: string): Promise<{ liked: boolean }> {
    const [existing] = await db
      .select({ id: likes.id })
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.episodeId, episodeId)))
      .limit(1)
    if (existing) {
      await db.delete(likes).where(eq(likes.id, existing.id))
      return { liked: false }
    }
    await db.insert(likes).values({ userId, episodeId })
    return { liked: true }
  }

  async isLiked(userId: string, episodeId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: likes.id })
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.episodeId, episodeId)))
      .limit(1)
    return row !== undefined
  }

  async countForEpisode(episodeId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(likes)
      .where(eq(likes.episodeId, episodeId))
    return Number(row?.n ?? 0)
  }
}

export class DrizzleStarRepository implements StarRepository {
  async set(userId: string, novelId: string, value: number): Promise<void> {
    await db
      .insert(stars)
      .values({ userId, novelId, value })
      .onConflictDoUpdate({
        target: [stars.userId, stars.novelId],
        set: { value, updatedAt: new Date() },
      })
  }

  async get(userId: string, novelId: string): Promise<number | null> {
    const [row] = await db
      .select({ value: stars.value })
      .from(stars)
      .where(and(eq(stars.userId, userId), eq(stars.novelId, novelId)))
      .limit(1)
    return row?.value ?? null
  }

  async aggregate(novelId: string): Promise<{ avg: number; count: number }> {
    const [row] = await db
      .select({
        avg: sql<number>`coalesce(avg(${stars.value}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(stars)
      .where(eq(stars.novelId, novelId))
    return { avg: Number(row?.avg ?? 0), count: Number(row?.count ?? 0) }
  }
}

export class DrizzleReviewRepository implements ReviewRepository {
  async upsert(input: {
    userId: string
    novelId: string
    stars: number
    title: string
    body: string
  }): Promise<void> {
    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, input.userId),
          eq(reviews.novelId, input.novelId),
          isNull(reviews.deletedAt),
        ),
      )
      .limit(1)
    if (existing) {
      await db
        .update(reviews)
        .set({ stars: input.stars, title: input.title, body: input.body, updatedAt: new Date() })
        .where(eq(reviews.id, existing.id))
      return
    }
    await db.insert(reviews).values({
      userId: input.userId,
      novelId: input.novelId,
      stars: input.stars,
      title: input.title,
      body: input.body,
    })
  }

  async listForNovel(novelId: string): Promise<Review[]> {
    return db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        authorHandle: users.handle,
        authorName: users.displayName,
        stars: reviews.stars,
        title: reviews.title,
        body: reviews.body,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(and(eq(reviews.novelId, novelId), isNull(reviews.deletedAt)))
      .orderBy(desc(reviews.createdAt))
  }

  async findByUser(userId: string, novelId: string): Promise<Review | null> {
    const [row] = await db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        authorHandle: users.handle,
        authorName: users.displayName,
        stars: reviews.stars,
        title: reviews.title,
        body: reviews.body,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(
        and(eq(reviews.userId, userId), eq(reviews.novelId, novelId), isNull(reviews.deletedAt)),
      )
      .limit(1)
    return row ?? null
  }
}

export class DrizzleCommentRepository implements CommentRepository {
  async create(input: {
    episodeId: string
    userId: string
    body: string
    parentId?: string | null
  }): Promise<void> {
    await db.insert(comments).values({
      episodeId: input.episodeId,
      userId: input.userId,
      body: input.body,
      parentId: input.parentId ?? null,
    })
  }

  async listForEpisode(episodeId: string): Promise<Comment[]> {
    const rows = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        authorHandle: users.handle,
        authorName: users.displayName,
        body: comments.body,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        deletedAt: comments.deletedAt,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.episodeId, episodeId))
      .orderBy(asc(comments.createdAt))
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      authorHandle: r.authorHandle,
      authorName: r.authorName,
      body: r.deletedAt ? '' : r.body,
      parentId: r.parentId,
      createdAt: r.createdAt,
      deleted: r.deletedAt !== null,
    }))
  }
}

export class DrizzleFollowRepository implements FollowRepository {
  async toggleUser(followerId: string, followeeId: string): Promise<{ following: boolean }> {
    const [existing] = await db
      .select({ id: userFollows.id })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId)))
      .limit(1)
    if (existing) {
      await db.delete(userFollows).where(eq(userFollows.id, existing.id))
      return { following: false }
    }
    await db.insert(userFollows).values({ followerId, followeeId })
    return { following: true }
  }

  async isFollowingUser(followerId: string, followeeId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: userFollows.id })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId)))
      .limit(1)
    return row !== undefined
  }

  async toggleNovel(userId: string, novelId: string): Promise<{ following: boolean }> {
    const [existing] = await db
      .select({ id: novelFollows.id })
      .from(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, novelId)))
      .limit(1)
    if (existing) {
      await db.delete(novelFollows).where(eq(novelFollows.id, existing.id))
      return { following: false }
    }
    await db.insert(novelFollows).values({ userId, novelId })
    return { following: true }
  }

  async isFollowingNovel(userId: string, novelId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: novelFollows.id })
      .from(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, novelId)))
      .limit(1)
    return row !== undefined
  }

  async novelFollowerIds(novelId: string): Promise<string[]> {
    const rows = await db
      .select({ userId: novelFollows.userId })
      .from(novelFollows)
      .where(eq(novelFollows.novelId, novelId))
    return rows.map((r) => r.userId)
  }
}
