import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Postgres enum types (data-model.md §3.0). Enums are added per phase; only add
 * values over time — never remove or reorder (data-model.md §1.2).
 */
export const userStatus = pgEnum('user_status', ['active', 'suspended', 'banned'])

// novel / writing (Phase 2)
export const visibility = pgEnum('visibility', ['public', 'unlisted', 'private'])
export const publicationStatus = pgEnum('publication_status', ['ongoing', 'completed', 'hiatus'])
export const episodeStatus = pgEnum('episode_status', ['draft', 'published'])
export const genre = pgEnum('genre', [
  'fantasy',
  'sf',
  'romance',
  'mystery',
  'horror',
  'literary',
  'essay',
  'other',
])
export const contentState = pgEnum('content_state', ['visible', 'hidden'])
export const forkPolicy = pgEnum('fork_policy', ['disabled', 'approval_required', 'allowed'])
export const collaboratorRole = pgEnum('collaborator_role', [
  'owner',
  'admin',
  'writer',
  'editor',
  'viewer',
])
export const invitationStatus = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
])

// moderation (Phase 8)
export const reportTargetType = pgEnum('report_target_type', [
  'user',
  'novel',
  'episode',
  'comment',
  'review',
])
export const reportStatus = pgEnum('report_status', ['open', 'reviewing', 'resolved', 'dismissed'])

// reading (Phase 3)
export const libraryState = pgEnum('library_state', [
  'reading',
  'read_later',
  'completed',
  'favorite',
])

// social & notification (Phase 4)
export const notificationType = pgEnum('notification_type', [
  'user_follow',
  'novel_follow',
  'like',
  'star',
  'review',
  'comment',
  'novel_update',
  'collaboration_invite',
  'fork',
  'change_proposal',
])
