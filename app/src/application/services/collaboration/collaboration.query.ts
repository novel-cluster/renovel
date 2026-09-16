import type {
  Collaborator,
  CollaboratorRepository,
  CollaboratorRole,
  InvitationRepository,
  PendingInvitation,
} from '@/domain/collaboration/collaboration'
import type { Novel } from '@/domain/novel/entities/novel'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from './novel-authorization.service'

export interface CollaboratorsView {
  novel: Novel
  role: CollaboratorRole
  collaborators: Collaborator[]
}

/** Studio collaborators panel + a user's pending invitations. */
export class CollaborationQuery {
  constructor(
    private readonly authz: NovelAuthorizationService,
    private readonly novels: NovelRepository,
    private readonly collaborators: CollaboratorRepository,
    private readonly invitations: InvitationRepository,
  ) {}

  async collaboratorsView(actorUserId: string, novelId: string): Promise<CollaboratorsView> {
    const novel = await this.novels.findById(novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    const role = await this.authz.roleOf(novel, actorUserId)
    if (!role) throw new NotFoundError('作品が見つかりません')
    const list = await this.collaborators.list(novel.id)
    return { novel, role, collaborators: list }
  }

  pendingInvitations(userId: string): Promise<PendingInvitation[]> {
    return this.invitations.pendingForUser(userId)
  }
}
