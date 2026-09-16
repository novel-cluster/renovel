import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { pk, softDelete, timestamps } from './_shared'
import { citext } from './citext'
import { userStatus } from './enums'

/** `users.external_links` shape (data-model.md §identity). Max 5 enforced in app. */
export type ExternalLink = { label: string; url: string }

/**
 * identity domain tables (data-model.md §identity, auth.md).
 * `users`: account + public profile. `sessions`: opaque-token sessions.
 * `oauth_accounts`: external logins (schema placeholder for a later phase).
 */
export const users = pgTable(
  'users',
  {
    id: pk(),
    handle: text('handle').notNull().unique(),
    displayName: text('display_name').notNull(),
    iconUrl: text('icon_url'),
    bio: text('bio'),
    externalLinks: jsonb('external_links').$type<ExternalLink[]>().notNull().default([]),
    email: citext('email'),
    passwordHash: text('password_hash'),
    status: userStatus('status').notNull().default('active'),
    // Site moderator flag (moderation.md). Kept simple as a boolean for 1.0.
    isAdmin: boolean('is_admin').notNull().default(false),
    ...softDelete,
    ...timestamps,
  },
  (t) => [
    // Case-insensitive unique email among live, email-bearing accounts.
    uniqueIndex('users_email_uq')
      .on(t.email)
      .where(sql`${t.deletedAt} is null and ${t.email} is not null`),
    // Only non-active accounts are interesting to scan (moderation).
    index('users_status_idx').on(t.status).where(sql`${t.status} <> 'active'`),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('oauth_provider_account_uq').on(t.provider, t.providerAccountId),
    uniqueIndex('oauth_user_provider_uq').on(t.userId, t.provider),
    index('oauth_user_idx').on(t.userId),
  ],
)
