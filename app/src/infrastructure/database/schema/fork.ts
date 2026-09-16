import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { users } from './identity'
import { novels } from './novel'

/**
 * fork domain (data-model.md §fork, PRD §14–15). Append-only: attribution
 * (`source_novel_id`) must never be removed. `source` uses ON DELETE RESTRICT so
 * an original cannot be hard-deleted out from under its derivatives.
 */
export const forks = pgTable(
  'forks',
  {
    id: pk(),
    sourceNovelId: uuid('source_novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'restrict' }),
    forkedNovelId: uuid('forked_novel_id')
      .notNull()
      .unique()
      .references(() => novels.id, { onDelete: 'cascade' }),
    forkedBy: uuid('forked_by').references(() => users.id, { onDelete: 'set null' }),
    rootNovelId: uuid('root_novel_id').references(() => novels.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (t) => [
    index('forks_source_idx').on(t.sourceNovelId),
    uniqueIndex('forks_forked_uq').on(t.forkedNovelId),
  ],
)
