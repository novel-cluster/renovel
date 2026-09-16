import type { NotificationRepository } from '@/domain/notification/notification'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import type { ReadingProgressRepository } from '@/domain/reading/repositories/reading-progress-repository'
import type {
  CommentRepository,
  FollowRepository,
  LikeRepository,
  ReviewRepository,
  StarRepository,
} from '@/domain/social/repositories'
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors/app-error'

/** Toggle a like on an episode; notify the author on a new like (PRD §20.1). */
export class ToggleLikeService {
  constructor(
    private readonly likes: LikeRepository,
    private readonly episodes: EpisodeRepository,
    private readonly novels: NovelRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: { userId: string; episodeId: string }): Promise<{ liked: boolean }> {
    const episode = await this.episodes.findById(input.episodeId)
    if (!episode) throw new NotFoundError('エピソードが見つかりません')
    const { liked } = await this.likes.toggle(input.userId, input.episodeId)
    await this.novels.addLikeCount(episode.novelId, liked ? 1 : -1)
    if (liked) {
      const novel = await this.novels.findById(episode.novelId)
      if (novel) {
        await this.notifications.createMany([
          {
            userId: novel.authorId,
            type: 'like',
            actorId: input.userId,
            payload: {
              novelId: novel.id,
              novelSlug: novel.slug,
              novelTitle: novel.title,
              episodeId: episode.id,
              episodeNo: episode.episodeNo,
            },
          },
        ])
      }
    }
    return { liked }
  }
}

/** Set the user's 1–3 star for a novel and refresh the cached aggregate (PRD §20.2). */
export class SetStarService {
  constructor(
    private readonly stars: StarRepository,
    private readonly novels: NovelRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: { userId: string; novelId: string; value: number }): Promise<void> {
    if (!Number.isInteger(input.value) || input.value < 1 || input.value > 3) {
      throw new ValidationError('評価は1〜3で入力してください')
    }
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    const previous = await this.stars.get(input.userId, input.novelId)
    await this.stars.set(input.userId, input.novelId, input.value)
    const agg = await this.stars.aggregate(input.novelId)
    await this.novels.setStarAggregate(input.novelId, agg.avg, agg.count)
    if (previous === null) {
      await this.notifications.createMany([
        {
          userId: novel.authorId,
          type: 'star',
          actorId: input.userId,
          payload: { novelId: novel.id, novelSlug: novel.slug, novelTitle: novel.title },
        },
      ])
    }
  }
}

/** Create or update the user's review for a novel (PRD §20.3). */
export class UpsertReviewService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly novels: NovelRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: {
    userId: string
    novelId: string
    stars: number
    title: string
    body: string
  }): Promise<void> {
    if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 3) {
      throw new ValidationError('評価は1〜3で入力してください')
    }
    const title = input.title.trim()
    const body = input.body.trim()
    if (!title || !body) throw new ValidationError('タイトルと本文を入力してください')
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')

    const existing = await this.reviews.findByUser(input.userId, input.novelId)
    await this.reviews.upsert({
      userId: input.userId,
      novelId: input.novelId,
      stars: input.stars,
      title,
      body,
    })
    if (!existing) {
      await this.notifications.createMany([
        {
          userId: novel.authorId,
          type: 'review',
          actorId: input.userId,
          payload: { novelId: novel.id, novelSlug: novel.slug, novelTitle: novel.title },
        },
      ])
    }
  }
}

/** Post a comment on a published episode after the user has read it (PRD §20.4). */
export class PostCommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly episodes: EpisodeRepository,
    private readonly novels: NovelRepository,
    private readonly progress: ReadingProgressRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: {
    userId: string
    episodeId: string
    body: string
    parentId?: string | null
  }): Promise<void> {
    const body = input.body.trim()
    if (!body) throw new ValidationError('コメントを入力してください')
    const episode = await this.episodes.findById(input.episodeId)
    if (!episode) throw new NotFoundError('エピソードが見つかりません')
    if (episode.status !== 'published')
      throw new ForbiddenError('公開前のエピソードにはコメントできません')
    if (!(await this.progress.hasRead(input.userId, input.episodeId))) {
      throw new ForbiddenError('エピソードを読むとコメントできます')
    }
    await this.comments.create({
      episodeId: input.episodeId,
      userId: input.userId,
      body,
      parentId: input.parentId ?? null,
    })
    const novel = await this.novels.findById(episode.novelId)
    if (novel) {
      await this.notifications.createMany([
        {
          userId: novel.authorId,
          type: 'comment',
          actorId: input.userId,
          payload: {
            novelId: novel.id,
            novelSlug: novel.slug,
            novelTitle: novel.title,
            episodeId: episode.id,
            episodeNo: episode.episodeNo,
          },
        },
      ])
    }
  }
}

/** Follow/unfollow a user (PRD §21). */
export class ToggleUserFollowService {
  constructor(
    private readonly follows: FollowRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: {
    followerId: string
    followeeId: string
  }): Promise<{ following: boolean }> {
    if (input.followerId === input.followeeId) {
      throw new ValidationError('自分自身はフォローできません')
    }
    const { following } = await this.follows.toggleUser(input.followerId, input.followeeId)
    if (following) {
      await this.notifications.createMany([
        { userId: input.followeeId, type: 'user_follow', actorId: input.followerId },
      ])
    }
    return { following }
  }
}

/** Follow/unfollow a novel for update notifications (PRD §21–22). */
export class ToggleNovelFollowService {
  constructor(
    private readonly follows: FollowRepository,
    private readonly novels: NovelRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: { userId: string; novelId: string }): Promise<{ following: boolean }> {
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    const { following } = await this.follows.toggleNovel(input.userId, input.novelId)
    await this.novels.addFollowCount(input.novelId, following ? 1 : -1)
    if (following) {
      await this.notifications.createMany([
        {
          userId: novel.authorId,
          type: 'novel_follow',
          actorId: input.userId,
          payload: { novelId: novel.id, novelSlug: novel.slug, novelTitle: novel.title },
        },
      ])
    }
    return { following }
  }
}

/** Fan-out a novel_update notification to followers when an episode publishes. */
export class NotifyNovelUpdateService {
  constructor(
    private readonly follows: FollowRepository,
    private readonly novels: NovelRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: { novelId: string; episodeId: string; episodeNo: number }): Promise<void> {
    const followerIds = await this.follows.novelFollowerIds(input.novelId)
    if (followerIds.length === 0) return
    const novel = await this.novels.findById(input.novelId)
    if (!novel) return
    await this.notifications.createMany(
      followerIds.map((userId) => ({
        userId,
        type: 'novel_update' as const,
        actorId: novel.authorId,
        payload: {
          novelId: novel.id,
          novelSlug: novel.slug,
          novelTitle: novel.title,
          episodeId: input.episodeId,
          episodeNo: input.episodeNo,
        },
      })),
    )
  }
}
