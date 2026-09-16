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
