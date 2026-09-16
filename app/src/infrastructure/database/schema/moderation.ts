import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { reportStatus, reportTargetType } from './enums'
import { users } from './identity'

/** moderation domain (data-model.md §moderation, PRD §37). */
export const reports = pgTable(
  'reports',
  {
    id: pk(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: reportTargetType('target_type').notNull(),
    // Loose target id (points at users/novels/episodes/comments/reviews by type).
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    status: reportStatus('status').notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
)

export const blocks = pgTable(
  'blocks',
  {
    id: pk(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('blocks_uq').on(t.blockerId, t.blockedId)],
)

export const mutes = pgTable(
  'mutes',
  {
    id: pk(),
    muterId: uuid('muter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mutedId: uuid('muted_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('mutes_uq').on(t.muterId, t.mutedId)],
)
