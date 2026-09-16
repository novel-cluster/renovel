import type { Context } from 'hono'
import type { AnalyticsEventType } from '@/domain/analytics/analytics'
import { visitorId } from '@/presentation/analytics/visitor'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { renderPage } from '@/presentation/views/render'
import { AnalyticsPage } from '@/presentation/views/studio/analytics'

/** `GET /studio/novels/:novelId/analytics` — author dashboard (owner only). */
export async function getNovelAnalytics(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const novelId = c.req.param('novelId') ?? ''
  const days = Number(c.req.query('days')) === 7 ? 7 : 30
  const dashboard = await container.analyticsDashboardQuery.execute(viewer.id, novelId, days)
  return renderPage(c, <AnalyticsPage dashboard={dashboard} novelId={novelId} viewer={viewer} />)
}

const CLIENT_EVENTS = new Set<AnalyticsEventType>([
  'episode_read_start',
  'episode_progress_25',
  'episode_progress_50',
  'episode_progress_75',
  'episode_complete',
  'next_episode',
])

/**
 * `POST /api/analytics/events` — fire-and-forget ingestion (routing.md §5,
 * PRD §55). Always returns 202; validation failures are silently ignored so the
 * reader is never affected.
 */
export async function postAnalyticsEvent(c: Context<AppEnv>) {
  try {
    const body = (await c.req.json().catch(() => null)) as {
      type?: string
      novelId?: string
      episodeId?: string
    } | null
    const type = body?.type
    if (type && CLIENT_EVENTS.has(type as AnalyticsEventType)) {
      void container.recordAnalyticsEventService
        .execute({
          eventType: type as AnalyticsEventType,
          novelId: body?.novelId ?? null,
          episodeId: body?.episodeId ?? null,
          actorId: c.get('user')?.id ?? null,
          sessionId: visitorId(c),
        })
        .catch(() => {})
    }
  } catch {}
  return c.body(null, 202)
}
