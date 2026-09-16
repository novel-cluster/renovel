import { sql } from 'drizzle-orm'
import { check, index, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, softDelete, timestamps } from './_shared'
import { users } from './identity'
import { episodes, novels } from './novel'

/** social domain (data-model.md §social, PRD §20–21). */

export const likes = pgTable(
  'likes',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('likes_user_episode_uq').on(t.userId, t.episodeId),
    index('likes_episode_idx').on(t.episodeId),
  ],
)

export const stars = pgTable(
  'stars',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('stars_user_novel_uq').on(t.userId, t.novelId),
    index('stars_novel_idx').on(t.novelId),
    check('stars_value_range', sql`${t.value} between 1 and 3`),
  ],
)

export const reviews = pgTable(
  'reviews',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    stars: smallint('stars').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    ...softDelete,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reviews_user_novel_uq').on(t.userId, t.novelId).where(sql`${t.deletedAt} is null`),
    index('reviews_novel_idx').on(t.novelId),
    check('reviews_stars_range', sql`${t.stars} between 1 and 3`),
  ],
)

export const comments = pgTable(
  'comments',
  {
    id: pk(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    body: text('body').notNull(),
    ...softDelete,
    ...timestamps,
  },
  (t) => [index('comments_episode_idx').on(t.episodeId), index('comments_user_idx').on(t.userId)],
)

export const userFollows = pgTable(
  'user_follows',
  {
    id: pk(),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('user_follows_uq').on(t.followerId, t.followeeId),
    index('user_follows_followee_idx').on(t.followeeId),
    check('user_follows_no_self', sql`${t.followerId} <> ${t.followeeId}`),
  ],
)

export const novelFollows = pgTable(
  'novel_follows',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('novel_follows_uq').on(t.userId, t.novelId),
    index('novel_follows_novel_idx').on(t.novelId),
  ],
)
