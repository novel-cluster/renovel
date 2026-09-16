import { index, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Analytics is physically separated into its own Postgres schema (data-model.md
 * §1.7, architecture.md §7). These tables hold NO foreign keys into the
 * transactional (`public`) schema — `novel_id`/`episode_id`/`actor_id` are loose
 * uuid columns — so analytics can later move to its own database/service.
 */
export const analytics = pgSchema('analytics')

export type AnalyticsProps = Record<string, string | number | boolean>

export const analyticsEvents = analytics.table(
  'analytics_events',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => Bun.randomUUIDv7()),
    eventType: text('event_type').notNull(),
    novelId: uuid('novel_id'),
    episodeId: uuid('episode_id'),
    // Aggregation only — never exposed per-user (PRD §58).
    actorId: uuid('actor_id'),
    sessionId: text('session_id'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    props: jsonb('props').$type<AnalyticsProps>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('analytics_events_novel_idx').on(t.novelId, t.occurredAt),
    index('analytics_events_episode_idx').on(t.episodeId, t.eventType),
  ],
)
