import type { CollaboratorRepository } from '@/domain/collaboration/collaboration'
import type { EpisodeSummary } from '@/domain/novel/entities/episode'
import type { Novel } from '@/domain/novel/entities/novel'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from '../collaboration/novel-authorization.service'

/** Novels the user owns or collaborates on, for the studio index. */
export class ListStudioNovelsService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly collaborators: CollaboratorRepository,
  ) {}

  async execute(userId: string): Promise<Novel[]> {
    const owned = await this.novels.listByAuthor(userId)
    const collaboratedIds = await this.collaborators.novelIdsForUser(userId)
    const collaborated = (
      await Promise.all(collaboratedIds.map((id) => this.novels.findById(id)))
    ).filter((n): n is Novel => n !== null)
    return [...owned, ...collaborated]
  }
}

export interface StudioNovel {
  novel: Novel
  episodes: EpisodeSummary[]
}

/** A single novel plus all its episodes (any collaborator with view access). */
export class GetNovelStudioService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly authz: NovelAuthorizationService,
  ) {}

  async execute(actorUserId: string, novelId: string): Promise<StudioNovel> {
    const novel = await this.novels.findById(novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, actorUserId, 'view.private')
    const episodes = await this.episodes.listByNovel(novel.id)
    return { novel, episodes }
  }
}
