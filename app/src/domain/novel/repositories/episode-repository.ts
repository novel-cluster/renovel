import type { Episode, EpisodeStatus, EpisodeSummary } from '../entities/episode'
import type { Visibility } from '../entities/novel'

export interface NewEpisode {
  novelId: string
  episodeNo: number
  orderIndex: number
  title: string
  body: string
  charCount: number
}

export interface EpisodeUpdate {
  title?: string
  body?: string
  charCount?: number
  status?: EpisodeStatus
  visibility?: Visibility | null
  publishedAt?: Date | null
}

/** Episode persistence port. */
export interface EpisodeRepository {
  findById(id: string): Promise<Episode | null>
  findByNovelAndNo(novelId: string, episodeNo: number): Promise<Episode | null>
  /** All episodes (studio view), ordered by `order_index`. */
  listByNovel(novelId: string): Promise<EpisodeSummary[]>
  /** Published episodes only (public table of contents). */
  listPublishedByNovel(novelId: string): Promise<EpisodeSummary[]>
  /** Next `episode_no`/`order_index` for a novel (max + 1, or 1). */
  nextEpisodeNo(novelId: string): Promise<number>
  create(input: NewEpisode): Promise<Episode>
  update(id: string, patch: EpisodeUpdate): Promise<Episode>
}
