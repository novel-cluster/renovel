import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import type {
  AnalyticsEventInput,
  AnalyticsEventRepository,
  EpisodeViewCount,
} from '@/domain/analytics/analytics'
import { db } from '@/infrastructure/database/drizzle/client'
import { analyticsEvents } from '@/infrastructure/database/schema'

// A visitor is identified by the logged-in user id when present, else the
// anonymous session cookie — for unique counting only.
const visitor = sql`coalesce(${analyticsEvents.actorId}::text, ${analyticsEvents.sessionId})`

export class DrizzleAnalyticsEventRepository implements AnalyticsEventRepository {
  async record(input: AnalyticsEventInput): Promise<void> {
    await db.insert(analyticsEvents).values({
      eventType: input.eventType,
      novelId: input.novelId ?? null,
      episodeId: input.episodeId ?? null,
      actorId: input.actorId ?? null,
      sessionId: input.sessionId ?? null,
      utmSource: input.utm?.source ?? null,
      utmMedium: input.utm?.medium ?? null,
      utmCampaign: input.utm?.campaign ?? null,
      props: input.props ?? {},
    })
  }

  async novelPageviews(novelId: string, since: Date): Promise<{ pv: number; unique: number }> {
    const [row] = await db
      .select({
        pv: sql<number>`count(*)`,
        unique: sql<number>`count(distinct ${visitor})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.novelId, novelId),
          inArray(analyticsEvents.eventType, ['novel_view', 'episode_view']),
          gte(analyticsEvents.occurredAt, since),
        ),
      )
    return { pv: Number(row?.pv ?? 0), unique: Number(row?.unique ?? 0) }
  }

  async episodeViewCounts(novelId: string, since: Date): Promise<EpisodeViewCount[]> {
    const rows = await db
      .select({
        episodeId: analyticsEvents.episodeId,
        views: sql<number>`count(*)`,
        unique: sql<number>`count(distinct ${visitor})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.novelId, novelId),
          eq(analyticsEvents.eventType, 'episode_view'),
          gte(analyticsEvents.occurredAt, since),
        ),
      )
      .groupBy(analyticsEvents.episodeId)
    return rows
      .filter(
        (r): r is { episodeId: string; views: number; unique: number } => r.episodeId !== null,
      )
      .map((r) => ({ episodeId: r.episodeId, views: Number(r.views), unique: Number(r.unique) }))
  }

  async episodeCompletions(novelId: string, since: Date): Promise<Record<string, number>> {
    const rows = await db
      .select({ episodeId: analyticsEvents.episodeId, n: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.novelId, novelId),
          eq(analyticsEvents.eventType, 'episode_complete'),
          gte(analyticsEvents.occurredAt, since),
        ),
      )
      .groupBy(analyticsEvents.episodeId)
    const out: Record<string, number> = {}
    for (const r of rows) if (r.episodeId) out[r.episodeId] = Number(r.n)
    return out
  }
}
