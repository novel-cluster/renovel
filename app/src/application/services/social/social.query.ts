import type {
  Comment,
  CommentRepository,
  FollowRepository,
  LikeRepository,
  Review,
  ReviewRepository,
  StarRepository,
} from '@/domain/social/repositories'

export interface EpisodeSocial {
  likeCount: number
  liked: boolean
  comments: Comment[]
}

/** Social data for an episode reading page. */
export class EpisodeSocialQuery {
  constructor(
    private readonly likes: LikeRepository,
    private readonly comments: CommentRepository,
  ) {}

  async execute(episodeId: string, viewerId: string | null): Promise<EpisodeSocial> {
    const [likeCount, liked, comments] = await Promise.all([
      this.likes.countForEpisode(episodeId),
      viewerId ? this.likes.isLiked(viewerId, episodeId) : Promise.resolve(false),
      this.comments.listForEpisode(episodeId),
    ])
    return { likeCount, liked, comments }
  }
}

export interface NovelSocial {
  myStar: number | null
  following: boolean
  reviews: Review[]
  myReview: Review | null
}

/** Social data for a novel page. */
export class NovelSocialQuery {
  constructor(
    private readonly stars: StarRepository,
    private readonly reviews: ReviewRepository,
    private readonly follows: FollowRepository,
  ) {}

  async execute(novelId: string, viewerId: string | null): Promise<NovelSocial> {
    const [myStar, following, reviews, myReview] = await Promise.all([
      viewerId ? this.stars.get(viewerId, novelId) : Promise.resolve(null),
      viewerId ? this.follows.isFollowingNovel(viewerId, novelId) : Promise.resolve(false),
      this.reviews.listForNovel(novelId),
      viewerId ? this.reviews.findByUser(viewerId, novelId) : Promise.resolve(null),
    ])
    return { myStar, following, reviews, myReview }
  }
}
