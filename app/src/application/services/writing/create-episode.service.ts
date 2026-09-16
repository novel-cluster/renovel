import type { Episode } from '@/domain/novel/entities/episode'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from '../collaboration/novel-authorization.service'

export interface CreateEpisodeInput {
  actorUserId: string
  novelId: string
  title?: string
}

/** Create a new draft Episode with the next episode number (auth.md §3.1). */
export class CreateEpisodeService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly authz: NovelAuthorizationService,
  ) {}

  async execute(input: CreateEpisodeInput): Promise<Episode> {
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, input.actorUserId, 'episode.create')

    const episodeNo = await this.episodes.nextEpisodeNo(novel.id)
    const title = (input.title ?? '').trim() || `第${episodeNo}話`
    return this.episodes.create({
      novelId: novel.id,
      episodeNo,
      orderIndex: episodeNo,
      title,
      body: '',
      charCount: 0,
    })
  }
}
