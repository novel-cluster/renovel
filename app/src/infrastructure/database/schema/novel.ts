import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { pk, softDelete, timestamps } from './_shared'
import {
  contentState,
  episodeStatus,
  forkPolicy,
  genre,
  publicationStatus,
  visibility,
} from './enums'
import { users } from './identity'

/** `novels.content_warnings` element (data-model.md §novel, PRD §10). */
export type ContentWarning = string

/**
 * novel domain: `Novel → (optional) Chapter → Episode` (data-model.md §novel).
 * Visibility and Publication Status are orthogonal (PRD §8–9). Counter columns
 * (`like_count` etc.) are denormalized caches updated by later phases.
 */
export const novels = pgTable(
  'novels',
  {
    id: pk(),
    slug: text('slug').notNull().unique(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    catchphrase: text('catchphrase'),
    description: text('description'),
    genre: genre('genre'),
    visibility: visibility('visibility').notNull().default('private'),
    publicationStatus: publicationStatus('publication_status').notNull().default('ongoing'),
    contentState: contentState('content_state').notNull().default('visible'),
    contentWarnings: jsonb('content_warnings').$type<ContentWarning[]>().notNull().default([]),
    forkPolicy: forkPolicy('fork_policy').notNull().default('disabled'),
    totalCharCount: integer('total_char_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    starAvg: numeric('star_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    starCount: integer('star_count').notNull().default(0),
    followCount: integer('follow_count').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...softDelete,
    ...timestamps,
  },
  (t) => [
    index('novels_author_idx').on(t.authorId),
    // Public listing. discovery.md adds the pg_trgm GIN full-text index in Phase 5.
    index('novels_listing_idx')
      .on(t.visibility, t.publicationStatus, t.publishedAt.desc())
      .where(sql`${t.deletedAt} is null`),
  ],
)

export const chapters = pgTable(
  'chapters',
  {
    id: pk(),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    orderIndex: integer('order_index').notNull(),
    ...timestamps,
  },
  (t) => [
    index('chapters_novel_idx').on(t.novelId),
    uniqueIndex('chapters_order_uq').on(t.novelId, t.orderIndex),
  ],
)

export const episodes = pgTable(
  'episodes',
  {
    id: pk(),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
    episodeNo: integer('episode_no').notNull(),
    orderIndex: integer('order_index').notNull(),
    title: text('title').notNull(),
    // Plain text; notation is applied at the read path (text-notation.md).
    body: text('body').notNull().default(''),
    charCount: integer('char_count').notNull().default(0),
    status: episodeStatus('status').notNull().default('draft'),
    // NULL = inherit Novel visibility (data-model.md §episodes).
    visibility: visibility('visibility'),
    contentState: contentState('content_state').notNull().default('visible'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('episodes_no_uq').on(t.novelId, t.episodeNo),
    uniqueIndex('episodes_order_uq').on(t.novelId, t.orderIndex),
    index('episodes_chapter_idx').on(t.chapterId),
    index('episodes_published_idx').on(t.novelId, t.status, t.publishedAt),
  ],
)
