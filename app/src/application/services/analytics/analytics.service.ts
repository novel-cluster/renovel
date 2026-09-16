import { ensureNovelOwner } from '@/application/services/novel/ownership'
import type { AnalyticsEventInput, AnalyticsEventRepository } from '@/domain/analytics/analytics'
import type { EpisodeRepository } from '@/domain/novel/repositories/episode-repository'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError } from '@/shared/errors/app-error'

/** Fire-and-forget analytics ingestion (analytics.md, PRD §55). */
export class RecordAnalyticsEventService {
  constructor(private readonly events: AnalyticsEventRepository) {}

  execute(input: AnalyticsEventInput): Promise<void> {
    return this.events.record(input)
  }
}

export interface FunnelRow {
  episodeNo: number
  title: string
  views: number
  unique: number
  completions: number
  completionRate: number
  retentionFromFirst: number
}

export interface AnalyticsDashboard {
  novelTitle: string
  days: number
  pv: number
  uniqueVisitors: number
  likeCount: number
  starCount: number
  starAvg: number
  followCount: number
  funnel: FunnelRow[]
}

/**
 * Author analytics dashboard (PRD §29–32). Owner-only; results are aggregated
 * (never per-user, PRD §58). Reads events from the separated analytics schema
 * plus denormalized social counters.
 */
export class AnalyticsDashboardQuery {
  constructor(
    private readonly events: AnalyticsEventRepository,
    private readonly novels: NovelRepository,
    private readonly episodes: EpisodeRepository,
  ) {}

  async execute(actorUserId: string, novelId: string, days: number): Promise<AnalyticsDashboard> {
    const novel = await this.novels.findById(novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    ensureNovelOwner(novel, actorUserId)

    const since = new Date(Date.now() - days * 86_400_000)
    const [pageviews, viewCounts, completions, episodes] = await Promise.all([
      this.events.novelPageviews(novelId, since),
      this.events.episodeViewCounts(novelId, since),
      this.events.episodeCompletions(novelId, since),
      this.episodes.listByNovel(novelId),
    ])

    const viewsById = new Map(viewCounts.map((v) => [v.episodeId, v]))
    const published = episodes.filter((e) => e.status === 'published')
    const funnel: FunnelRow[] = published.map((e) => {
      const v = viewsById.get(e.id) ?? { views: 0, unique: 0 }
      const comp = completions[e.id] ?? 0
      return {
        episodeNo: e.episodeNo,
        title: e.title,
        views: v.views,
        unique: v.unique,
        completions: comp,
        completionRate: v.unique ? comp / v.unique : 0,
        retentionFromFirst: 0,
      }
    })
    const firstUnique = funnel[0]?.unique ?? 0
    for (const f of funnel) f.retentionFromFirst = firstUnique ? f.unique / firstUnique : 0

    return {
      novelTitle: novel.title,
      days,
      pv: pageviews.pv,
      uniqueVisitors: pageviews.unique,
      likeCount: novel.likeCount,
      starCount: novel.starCount,
      starAvg: novel.starAvg,
      followCount: novel.followCount,
      funnel,
    }
  }
}
