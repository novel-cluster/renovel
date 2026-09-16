import type {
  CollaboratorRepository,
  CollaboratorRole,
  InvitationRepository,
} from '@/domain/collaboration/collaboration'
import type { UserRepository } from '@/domain/identity/repositories/user-repository'
import type { NotificationRepository } from '@/domain/notification/notification'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error'
import type { NovelAuthorizationService } from './novel-authorization.service'

const ASSIGNABLE: CollaboratorRole[] = ['admin', 'writer', 'editor', 'viewer']

/** Invite a user (by handle) as a collaborator (auth.md §3.1 — owner/admin). */
export class InviteCollaboratorService {
  constructor(
    private readonly authz: NovelAuthorizationService,
    private readonly novels: NovelRepository,
    private readonly users: UserRepository,
    private readonly collaborators: CollaboratorRepository,
    private readonly invitations: InvitationRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: {
    actorUserId: string
    novelId: string
    handle: string
    role: CollaboratorRole
  }): Promise<void> {
    if (!ASSIGNABLE.includes(input.role)) throw new ValidationError('不正なロールです')
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, input.actorUserId, 'collaborator.manage')

    const invitee = await this.users.findByHandle(input.handle.trim().toLowerCase())
    if (!invitee) throw new NotFoundError('ユーザーが見つかりません')
    if (invitee.id === novel.authorId) throw new ConflictError('作者は既にオーナーです')
    if (await this.collaborators.roleFor(novel.id, invitee.id)) {
      throw new ConflictError('既に共同制作者です')
    }

    await this.invitations.invite({
      novelId: novel.id,
      inviteeId: invitee.id,
      inviterId: input.actorUserId,
      role: input.role,
    })
    await this.notifications.createMany([
      {
        userId: invitee.id,
        type: 'collaboration_invite',
        actorId: input.actorUserId,
        payload: { novelId: novel.id, novelSlug: novel.slug, novelTitle: novel.title },
      },
    ])
  }
}

/** Accept or decline a pending invitation. */
export class RespondInvitationService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly collaborators: CollaboratorRepository,
  ) {}

  async execute(input: {
    actorUserId: string
    invitationId: string
    accept: boolean
  }): Promise<void> {
    const invite = await this.invitations.findPending(input.invitationId)
    if (!invite || invite.inviteeId !== input.actorUserId) {
      throw new NotFoundError('招待が見つかりません')
    }
    if (input.accept) {
      await this.collaborators.add({
        novelId: invite.novelId,
        userId: input.actorUserId,
        role: invite.role,
        invitedBy: input.actorUserId,
      })
      await this.invitations.markResponded(invite.id, 'accepted')
    } else {
      await this.invitations.markResponded(invite.id, 'declined')
    }
  }
}

/** Remove a collaborator (owner/admin). */
export class RemoveCollaboratorService {
  constructor(
    private readonly authz: NovelAuthorizationService,
    private readonly novels: NovelRepository,
    private readonly collaborators: CollaboratorRepository,
  ) {}

  async execute(input: { actorUserId: string; novelId: string; userId: string }): Promise<void> {
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    await this.authz.ensureCan(novel, input.actorUserId, 'collaborator.manage')
    if (input.userId === novel.authorId) throw new ValidationError('オーナーは削除できません')
    await this.collaborators.remove(novel.id, input.userId)
  }
}
