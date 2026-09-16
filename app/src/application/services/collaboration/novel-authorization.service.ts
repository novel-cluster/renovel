import type {
  CollaboratorRepository,
  CollaboratorRole,
  NovelAction,
} from '@/domain/collaboration/collaboration'
import { can } from '@/domain/collaboration/collaboration'
import type { Novel } from '@/domain/novel/entities/novel'
import { ForbiddenError } from '@/shared/errors/app-error'

/**
 * Resolves a user's role on a novel (author = owner, else a collaborator row)
 * and enforces the permission matrix (auth.md §3.1). Replaces the Phase 2
 * "author only" checks so collaborators can act per their role.
 */
export class NovelAuthorizationService {
  constructor(private readonly collaborators: CollaboratorRepository) {}

  async roleOf(novel: Novel, userId: string): Promise<CollaboratorRole | null> {
    if (novel.authorId === userId) return 'owner'
    return this.collaborators.roleFor(novel.id, userId)
  }

  async ensureCan(novel: Novel, userId: string, action: NovelAction): Promise<CollaboratorRole> {
    const role = await this.roleOf(novel, userId)
    if (!can(role, action) || role === null) {
      throw new ForbiddenError('この操作を行う権限がありません')
    }
    return role
  }
}
