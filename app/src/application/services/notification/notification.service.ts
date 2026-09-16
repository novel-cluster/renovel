import type { NotificationRepository, NotificationView } from '@/domain/notification/notification'

/** Lists a user's notifications and marks them read (viewing = read). */
export class ListNotificationsService {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(userId: string): Promise<NotificationView[]> {
    const [list, _] = await Promise.all([
      this.notifications.listForUser(userId),
      this.notifications.markAllRead(userId)
    ]
    return list
  }
}

export class UnreadNotificationCountService {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(userId: string): Promise<number> {
    return this.notifications.unreadCount(userId)
  }
}
