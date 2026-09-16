import { ensureNovelOwner } from '@/application/services/novel/ownership'
import type { TagRepository } from '@/domain/discovery/discovery'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'

/** Replace a novel's tags (studio, owner-only). */
export class SetNovelTagsService {
  constructor(
    private readonly tags: TagRepository,
    private readonly novels: NovelRepository,
  ) {}

  async execute(input: { actorUserId: string; novelId: string; names: string[] }): Promise<void> {
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    ensureNovelOwner(novel, input.actorUserId)
    await this.tags.setNovelTags(novel.id, input.names)
  }
}
