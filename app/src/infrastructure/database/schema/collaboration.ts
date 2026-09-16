import { sql } from 'drizzle-orm'
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { collaboratorRole, invitationStatus } from './enums'
import { users } from './identity'
import { novels } from './novel'

/** collaboration domain (data-model.md §collaboration, PRD §13). */
export const collaborators = pgTable(
  'collaborators',
  {
    id: pk(),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: collaboratorRole('role').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('collaborators_novel_user_uq').on(t.novelId, t.userId),
    index('collaborators_user_idx').on(t.userId),
    // At most one Owner per novel.
    uniqueIndex('collaborators_owner_uq').on(t.novelId).where(sql`${t.role} = 'owner'`),
  ],
)

export const collaborationInvitations = pgTable(
  'collaboration_invitations',
  {
    id: pk(),
    novelId: uuid('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id').references(() => users.id, { onDelete: 'set null' }),
    role: collaboratorRole('role').notNull(),
    status: invitationStatus('status').notNull().default('pending'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('collaboration_invitations_invitee_idx').on(t.inviteeId, t.status),
    // Only one pending invite per (novel, invitee).
    uniqueIndex('collaboration_invitations_pending_uq')
      .on(t.novelId, t.inviteeId)
      .where(sql`${t.status} = 'pending'`),
  ],
)
