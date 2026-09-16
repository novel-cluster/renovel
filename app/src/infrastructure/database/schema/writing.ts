import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { users } from './identity'
import { episodes } from './novel'

/**
 * writing domain: append-only Episode history (data-model.md §writing,
 * writing-revision.md). Revisions are never updated/deleted — restore appends a
 * new revision. `source_proposal_id` (Change Proposal provenance) is added in
 * Phase 7 together with the `change_proposals` table.
 */
export const episodeRevisions = pgTable(
  'episode_revisions',
  {
    id: pk(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    editorId: uuid('editor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    revisionNo: integer('revision_no').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    charCount: integer('char_count').notNull().default(0),
    changeNote: text('change_note'),
    restoredFromId: uuid('restored_from_id').references((): AnyPgColumn => episodeRevisions.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('episode_revisions_no_uq').on(t.episodeId, t.revisionNo),
    index('episode_revisions_editor_idx').on(t.editorId),
  ],
)

export const scheduledPublishes = pgTable(
  'scheduled_publishes',
  {
    id: pk(),
    episodeId: uuid('episode_id')
      .notNull()
      .unique()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    // pending / done / canceled (data-model.md §writing).
    status: text('status').notNull().default('pending'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('scheduled_publishes_due_idx').on(t.status, t.scheduledAt)],
)
