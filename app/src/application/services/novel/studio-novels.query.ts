import type { EpisodeSummary } from '@/domain/novel/entities/episode'
import type { Novel } from '@/domain/novel/entities/novel'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'
import { ensureNovelOwner } from './ownership'

/** Author's own novels for the studio index. */
export class ListStudioNovelsService {
  constructor(private readonly novels: NovelRepository) {}

  execute(authorId: string): Promise<Novel[]> {
    return this.novels.listByAuthor(authorId)
  }
}

export interface StudioNovel {
  novel: Novel
  episodes: EpisodeSummary[]
}

/** A single novel plus all its episodes (owner-only studio dashboard). */
export class GetNovelStudioService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
  ) {}

  async execute(actorUserId: string, novelId: string): Promise<StudioNovel> {
    const novel = await this.novels.findById(novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    ensureNovelOwner(novel, actorUserId)
    const episodes = await this.episodes.listByNovel(novel.id)
    return { novel, episodes }
  }
}
