import type { Episode } from '@/domain/novel/entities/episode'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import type { EpisodeRevisionRepository } from '@/domain/writing/repositories/episode-revision-repository'
import { NotFoundError, ValidationError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from '../collaboration/novel-authorization.service'
import { countChars } from '../novel/ownership'

export interface SaveEpisodeInput {
  actorUserId: string
  episodeId: string
  title?: string
  body?: string
  /** Manual save records a revision; autosave does not (writing-revision.md §2.2). */
  createRevision: boolean
  changeNote?: string | null
}

/** Save an Episode's title/body. Body stays plain text (text-notation.md §1). */
export class SaveEpisodeService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly revisions: EpisodeRevisionRepository,
    private readonly authz: NovelAuthorizationService,
  ) {}

  async execute(input: SaveEpisodeInput): Promise<Episode> {
    const episode = await this.episodes.findById(input.episodeId)
    if (!episode) throw new NotFoundError('エピソードが見つかりません')
    const novel = await this.novels.findById(episode.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, input.actorUserId, 'episode.edit')

    const title = input.title !== undefined ? input.title.trim() : episode.title
    if (!title) throw new ValidationError('タイトルを入力してください')
    const body = input.body !== undefined ? input.body : episode.body
    const charCount = countChars(body)

    const updated = await this.episodes.update(episode.id, { title, body, charCount })

    if (input.createRevision) {
      const revisionNo = await this.revisions.nextRevisionNo(episode.id)
      await this.revisions.create({
        episodeId: episode.id,
        editorId: input.actorUserId,
        revisionNo,
        title,
        body,
        charCount,
        changeNote: input.changeNote ?? null,
      })
    }

    // Keep the novel's denormalized total in sync for already-published episodes.
    if (episode.status === 'published' && charCount !== episode.charCount) {
      await this.novels.addTotalCharCount(novel.id, charCount - episode.charCount)
    }

    return updated
  }
}
