import type { ForkRepository } from '@/domain/fork/fork'
import type { Novel } from '@/domain/novel/entities/novel'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NovelSlug } from '@/domain/novel/value-objects/novel-slug'
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error'

/**
 * Fork a novel into a new private novel owned by the forker, copying published
 * episodes as drafts (PRD §14). Fork Policy gates this (PRD §15). Attribution to
 * the source is recorded and never removable.
 */
export class ForkNovelService {
  constructor(
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
    private readonly forks: ForkRepository,
  ) {}

  async execute(input: { actorUserId: string; sourceSlug: string }): Promise<Novel> {
    const source = await this.novels.findBySlug(input.sourceSlug)
    if (!source) throw new NotFoundError('作品が見つかりません')
    if (source.visibility !== 'public') throw new NotFoundError('作品が見つかりません')
    if (source.forkPolicy === 'disabled') {
      throw new ForbiddenError('この作品は Fork が許可されていません')
    }
    if (source.forkPolicy === 'approval_required') {
      throw new ForbiddenError('この作品の Fork は承認制です（承認フローは今後対応）')
    }

    let slug = NovelSlug.generate()
    for (let i = 0; i < 5 && (await this.novels.slugExists(slug)); i++) slug = NovelSlug.generate()
    const forked = await this.novels.create({
      slug,
      authorId: input.actorUserId,
      title: source.title,
    })
    await this.novels.update(forked.id, {
      catchphrase: source.catchphrase,
      description: source.description,
      genre: source.genre,
      contentWarnings: source.contentWarnings,
    })

    // Copy published episodes as drafts in the fork.
    const published = await this.episodes.listPublishedByNovel(source.id)
    for (const summary of published) {
      const full = await this.episodes.findByNovelAndNo(source.id, summary.episodeNo)
      if (!full) continue
      const episodeNo = await this.episodes.nextEpisodeNo(forked.id)
      await this.episodes.create({
        novelId: forked.id,
        episodeNo,
        orderIndex: episodeNo,
        title: full.title,
        body: full.body,
        charCount: full.charCount,
      })
    }

    // Root = the source's own root when the source is itself a fork.
    const sourceAttribution = await this.forks.attributionFor(source.id)
    const rootNovelId = sourceAttribution?.sourceNovelId ?? source.id
    await this.forks.create({
      sourceNovelId: source.id,
      forkedNovelId: forked.id,
      forkedBy: input.actorUserId,
      rootNovelId,
    })

    return forked
  }
}
