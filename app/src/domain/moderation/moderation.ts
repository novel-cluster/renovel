export type ReportTargetType = 'user' | 'novel' | 'episode' | 'comment' | 'review'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type UserStatus = 'active' | 'suspended' | 'banned'

export interface ReportView {
  id: string
  targetType: ReportTargetType
  targetId: string
  reason: string
  status: ReportStatus
  reporterName: string | null
  createdAt: Date
}

/**
 * moderation domain (data-model.md §moderation, PRD §37). Admin actions write
 * across domains (hide/soft-delete/status), so the implementation touches
 * several tables — kept behind this port.
 */
export interface ModerationRepository {
  createReport(input: {
    reporterId: string
    targetType: ReportTargetType
    targetId: string
    reason: string
  }): Promise<void>
  listReports(status: ReportStatus | 'all'): Promise<ReportView[]>
  resolveReport(id: string, resolverId: string, status: 'resolved' | 'dismissed'): Promise<void>

  hideNovel(novelId: string): Promise<void>
  hideEpisode(episodeId: string): Promise<void>
  deleteComment(commentId: string): Promise<void>
  deleteReview(reviewId: string): Promise<void>
  setUserStatus(userId: string, status: UserStatus): Promise<void>

  toggleBlock(blockerId: string, blockedId: string): Promise<{ blocked: boolean }>
  toggleMute(muterId: string, mutedId: string): Promise<{ muted: boolean }>
}
