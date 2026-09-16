import type { Episode } from '@/domain/novel/entities/episode'
import type { Novel } from '@/domain/novel/entities/novel'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from '../collaboration/novel-authorization.service'

export interface EpisodeEditor {
  novel: Novel
  episode: Episode
}

/** Loads an Episode for the studio editor (owner only). */
export class GetEpisodeEditorService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly authz: NovelAuthorizationService,
  ) {}

  async execute(actorUserId: string, episodeId: string): Promise<EpisodeEditor> {
    const episode = await this.episodes.findById(episodeId)
    if (!episode) throw new NotFoundError('エピソードが見つかりません')
    const novel = await this.novels.findById(episode.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, actorUserId, 'episode.edit')
    return { novel, episode }
  }
}
