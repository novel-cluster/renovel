import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { notificationType } from './enums'
import { users } from './identity'

/** Notification payload (data-model.md §notification). Loose context refs. */
export type NotificationPayload = {
  novelId?: string
  novelSlug?: string
  novelTitle?: string
  authorHandle?: string
  episodeId?: string
  episodeNo?: number
  message?: string
}

/**
 * In-app notifications (data-model.md §notification, PRD §22). `actor_id` is the
 * user who triggered it (SET NULL on their deletion); `payload` carries display
 * context so rendering needs no extra joins.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    payload: jsonb('payload').$type<NotificationPayload>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
)
