import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type {
  NewNotification,
  NotificationRepository,
  NotificationView,
} from '@/domain/notification/notification'
import { db } from '@/infrastructure/database/drizzle/client'
import { notifications, users } from '@/infrastructure/database/schema'

export class DrizzleNotificationRepository implements NotificationRepository {
  async createMany(items: NewNotification[]): Promise<void> {
    // Never notify a user about their own action.
    const rows = items
      .filter((i) => i.actorId == null || i.actorId !== i.userId)
      .map((i) => ({
        userId: i.userId,
        type: i.type,
        actorId: i.actorId ?? null,
        payload: i.payload ?? {},
      }))
    if (rows.length === 0) return
    await db.insert(notifications).values(rows)
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationView[]> {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        actorHandle: users.handle,
        actorName: users.displayName,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      actorHandle: r.actorHandle,
      actorName: r.actorName,
      payload: r.payload,
      read: r.readAt !== null,
      createdAt: r.createdAt,
    }))
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return Number(row?.n ?? 0)
  }

  async markAllRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  }
}
