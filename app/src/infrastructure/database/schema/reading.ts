import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { libraryState } from './enums'
import { users } from './identity'
import { episodes, novels } from './novel'

/**
 * reading domain (data-model.md §reading). `reading_progress` is per-user,
 * per-episode; "continue reading" is resolved per novel by `last_read_at`.
 * These rows are private to the user (PRD §58).
 */
export const readingProgress = pgTable(
  'reading_progress',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    isCompleted: boolean('is_completed').notNull().default(false),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reading_progress_user_episode_uq').on(t.userId, t.episodeId),
    index('reading_progress_user_novel_idx').on(t.userId, t.novelId),
    index('reading_progress_recent_idx').on(t.userId, t.lastReadAt),
  ],
)

export const libraryEntries = pgTable(
  'library_entries',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    state: libraryState('state').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('library_entries_user_novel_uq').on(t.userId, t.novelId),
    index('library_entries_user_state_idx').on(t.userId, t.state),
  ],
)
