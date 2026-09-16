import type { Episode } from '@/domain/novel/entities/episode'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import type { EpisodeRevisionRepository } from '@/domain/writing/repositories/episode-revision-repository'
import { NotFoundError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from '../collaboration/novel-authorization.service'

export interface PublishEpisodeInput {
  actorUserId: string
  episodeId: string
}

/**
 * Publish a draft Episode (auth.md §3.1 — owner only). Records a revision at
 * publish and keeps the novel's denormalized totals / first-publish date in sync.
 */
export class PublishEpisodeService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly revisions: EpisodeRevisionRepository,
    private readonly authz: NovelAuthorizationService,
  ) {}

  async execute(input: PublishEpisodeInput): Promise<Episode> {
    const episode = await this.episodes.findById(input.episodeId)
    if (!episode) throw new NotFoundError('エピソードが見つかりません')
    const novel = await this.novels.findById(episode.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, input.actorUserId, 'episode.publish')

    if (episode.status === 'published') return episode

    const now = new Date()
    const updated = await this.episodes.update(episode.id, {
      status: 'published',
      publishedAt: episode.publishedAt ?? now,
    })

    const revisionNo = await this.revisions.nextRevisionNo(episode.id)
    await this.revisions.create({
      episodeId: episode.id,
      editorId: input.actorUserId,
      revisionNo,
      title: episode.title,
      body: episode.body,
      charCount: episode.charCount,
      changeNote: '公開',
    })

    await this.novels.addTotalCharCount(novel.id, episode.charCount)
    if (!novel.publishedAt) await this.novels.update(novel.id, { publishedAt: now })

    return updated
  }
}
