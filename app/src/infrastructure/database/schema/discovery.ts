import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { novels } from './novel'

/** Tags (data-model.md §discovery, PRD §23–24). */
export const tags = pgTable(
  'tags',
  {
    id: pk(),
    name: text('name').notNull().unique(),
    ...timestamps,
  },
  (t) => [uniqueIndex('tags_name_uq').on(t.name)],
)

export const novelTags = pgTable(
  'novel_tags',
  {
    id: pk(),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('novel_tags_uq').on(t.novelId, t.tagId),
    index('novel_tags_tag_idx').on(t.tagId),
  ],
)
