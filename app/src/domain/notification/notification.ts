export type NotificationType =
  | 'user_follow'
  | 'novel_follow'
  | 'like'
  | 'star'
  | 'review'
  | 'comment'
  | 'novel_update'
  | 'collaboration_invite'
  | 'fork'
  | 'change_proposal'

export interface NotificationPayload {
  novelId?: string
  novelSlug?: string
  novelTitle?: string
  authorHandle?: string
  episodeId?: string
  episodeNo?: number
  message?: string
}

export interface NewNotification {
  userId: string
  type: NotificationType
  actorId?: string | null
  payload?: NotificationPayload
}

export interface NotificationView {
  id: string
  type: NotificationType
  actorHandle: string | null
  actorName: string | null
  payload: NotificationPayload
  read: boolean
  createdAt: Date
}

/** In-app notifications (data-model.md §notification, PRD §22). */
export interface NotificationRepository {
  /** Create notifications, skipping any whose recipient equals the actor. */
  createMany(items: NewNotification[]): Promise<void>
  listForUser(userId: string, limit?: number): Promise<NotificationView[]>
  unreadCount(userId: string): Promise<number>
  markAllRead(userId: string): Promise<void>
}
