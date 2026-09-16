import type {
  ModerationRepository,
  ReportStatus,
  ReportTargetType,
  ReportView,
  UserStatus,
} from '@/domain/moderation/moderation'
import { ForbiddenError, ValidationError } from '@/shared/errors/app-error'

const TARGETS: ReportTargetType[] = ['user', 'novel', 'episode', 'comment', 'review']

export function isReportTarget(v: unknown): v is ReportTargetType {
  return typeof v === 'string' && (TARGETS as string[]).includes(v)
}

/** User reports content/users (PRD §37). */
export class ReportContentService {
  constructor(private readonly moderation: ModerationRepository) {}

  async execute(input: {
    reporterId: string
    targetType: ReportTargetType
    targetId: string
    reason: string
  }): Promise<void> {
    if (!isReportTarget(input.targetType)) throw new ValidationError('不正な対象です')
    if (!input.targetId) throw new ValidationError('対象がありません')
    const reason = input.reason.trim()
    if (!reason) throw new ValidationError('通報理由を入力してください')
    await this.moderation.createReport({ ...input, reason })
  }
}

interface Actor {
  id: string
  isAdmin: boolean
}

/** Admin moderation actions (PRD §37). Every method requires the admin flag. */
export class AdminModerationService {
  constructor(private readonly moderation: ModerationRepository) {}

  private ensure(actor: Actor): void {
    if (!actor.isAdmin) throw new ForbiddenError('管理者のみが実行できます')
  }

  listReports(actor: Actor, status: ReportStatus | 'all'): Promise<ReportView[]> {
    this.ensure(actor)
    return this.moderation.listReports(status)
  }

  resolveReport(actor: Actor, id: string, status: 'resolved' | 'dismissed'): Promise<void> {
    this.ensure(actor)
    return this.moderation.resolveReport(id, actor.id, status)
  }

  hideNovel(actor: Actor, novelId: string): Promise<void> {
    this.ensure(actor)
    return this.moderation.hideNovel(novelId)
  }

  hideEpisode(actor: Actor, episodeId: string): Promise<void> {
    this.ensure(actor)
    return this.moderation.hideEpisode(episodeId)
  }

  deleteComment(actor: Actor, commentId: string): Promise<void> {
    this.ensure(actor)
    return this.moderation.deleteComment(commentId)
  }

  deleteReview(actor: Actor, reviewId: string): Promise<void> {
    this.ensure(actor)
    return this.moderation.deleteReview(reviewId)
  }

  setUserStatus(actor: Actor, userId: string, status: UserStatus): Promise<void> {
    this.ensure(actor)
    return this.moderation.setUserStatus(userId, status)
  }
}

/** Block / mute a user (PRD §37). */
export class BlockMuteService {
  constructor(private readonly moderation: ModerationRepository) {}

  toggleBlock(userId: string, targetId: string): Promise<{ blocked: boolean }> {
    if (userId === targetId) throw new ValidationError('自分自身は指定できません')
    return this.moderation.toggleBlock(userId, targetId)
  }

  toggleMute(userId: string, targetId: string): Promise<{ muted: boolean }> {
    if (userId === targetId) throw new ValidationError('自分自身は指定できません')
    return this.moderation.toggleMute(userId, targetId)
  }
}
