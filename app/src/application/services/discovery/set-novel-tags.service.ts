import type { NovelAuthorizationService } from '@/application/services/collaboration/novel-authorization.service'
import type { TagRepository } from '@/domain/discovery/discovery'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'

/** Replace a novel's tags (studio settings — owner/admin). */
export class SetNovelTagsService {
  constructor(
    private readonly tags: TagRepository,
    private readonly novels: NovelRepository,
    private readonly authz: NovelAuthorizationService,
  ) {}

  async execute(input: { actorUserId: string; novelId: string; names: string[] }): Promise<void> {
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, input.actorUserId, 'novel.settings')
    await this.tags.setNovelTags(novel.id, input.names)
  }
}
