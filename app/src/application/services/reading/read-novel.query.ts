import type { UserRepository } from '@/domain/identity/repositories/user-repository'
import type { Episode, EpisodeSummary } from '@/domain/novel/entities/episode'
import type { Novel } from '@/domain/novel/entities/novel'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { canViewEpisode, canViewNovel } from '@/domain/novel/services/novel-access-policy'
import { NotFoundError } from '@/shared/errors/app-error'

export interface AuthorRef {
  handle: string
  displayName: string
  iconUrl: string | null
}

export interface NovelReadView {
  novel: Novel
  author: AuthorRef
  episodes: EpisodeSummary[]
  isOwner: boolean
}

export interface EpisodeReadView {
  novel: Novel
  author: AuthorRef
  episode: Episode
  prevNo: number | null
  nextNo: number | null
  isOwner: boolean
}

/**
 * Public read side (routing.md §3.1). Access is decided by the domain policy;
 * unauthorized viewers get 404 to hide existence (auth.md §4.3). The owner sees
 * drafts/private; everyone else sees only published/visible.
 */
export class ReadNovelQuery {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly users: UserRepository,
  ) {}

  async novelBySlug(slug: string, viewerId: string | null): Promise<NovelReadView> {
    const novel = await this.novels.findBySlug(slug)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    const isOwner = viewerId !== null && novel.authorId === viewerId
    if (
      !canViewNovel({ visibility: novel.visibility, contentState: novel.contentState, isOwner })
    ) {
      throw new NotFoundError('作品が見つかりません')
    }
    const [author, episodes] = await Promise.all([
      this.authorRef(novel.authorId),
      isOwner ? this.episodes.listByNovel(novel.id) : this.episodes.listPublishedByNovel(novel.id),
    ])
    return { novel, author, episodes, isOwner }
  }

  async episodeByNo(
    slug: string,
    episodeNo: number,
    viewerId: string | null,
  ): Promise<EpisodeReadView> {
    const novel = await this.novels.findBySlug(slug)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    const isOwner = viewerId !== null && novel.authorId === viewerId
    if (
      !canViewNovel({ visibility: novel.visibility, contentState: novel.contentState, isOwner })
    ) {
      throw new NotFoundError('作品が見つかりません')
    }

    const episode = await this.episodes.findByNovelAndNo(novel.id, episodeNo)
    if (
      !episode ||
      !canViewEpisode({
        novelVisibility: novel.visibility,
        novelContentState: novel.contentState,
        episodeStatus: episode.status,
        episodeVisibility: episode.visibility,
        episodeContentState: episode.contentState,
        isOwner,
      })
    ) {
      throw new NotFoundError('エピソードが見つかりません')
    }

    const [list, author] = await Promise.all([
      isOwner ? this.episodes.listByNovel(novel.id) : this.episodes.listPublishedByNovel(novel.id),
      this.authorRef(novel.authorId),
    ])
    const idx = list.findIndex((e) => e.episodeNo === episodeNo)
    const prevNo = idx > 0 ? list[idx - 1].episodeNo : null
    const nextNo = idx >= 0 && idx < list.length - 1 ? list[idx + 1].episodeNo : null

    return { novel, author, episode, prevNo, nextNo, isOwner }
  }

  private async authorRef(authorId: string): Promise<AuthorRef> {
    const author = await this.users.findById(authorId)
    if (!author) throw new NotFoundError('作品が見つかりません')
    return { handle: author.handle, displayName: author.displayName, iconUrl: author.iconUrl }
  }
}
