export type AnalyticsEventType =
  | 'novel_view'
  | 'episode_view'
  | 'episode_read_start'
  | 'episode_progress_25'
  | 'episode_progress_50'
  | 'episode_progress_75'
  | 'episode_complete'
  | 'next_episode'

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType
  novelId?: string | null
  episodeId?: string | null
  /** Aggregation only — never surfaced per-user (PRD §58). */
  actorId?: string | null
  sessionId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null }
  props?: Record<string, string | number | boolean>
}

export interface EpisodeViewCount {
  episodeId: string
  views: number
  unique: number
}

/**
 * Analytics ingestion + read-side (analytics.md). Ingestion must be
 * fire-and-forget (never block reading, PRD §55); all reads are aggregated.
 */
export interface AnalyticsEventRepository {
  record(input: AnalyticsEventInput): Promise<void>
  /** Total pageviews + unique visitors for a novel since a date. */
  novelPageviews(novelId: string, since: Date): Promise<{ pv: number; unique: number }>
  /** Per-episode view/unique counts (for the reading funnel). */
  episodeViewCounts(novelId: string, since: Date): Promise<EpisodeViewCount[]>
  /** Per-episode completion counts. */
  episodeCompletions(novelId: string, since: Date): Promise<Record<string, number>>
}
