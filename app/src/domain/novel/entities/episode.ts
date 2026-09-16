import type { ContentState, Visibility } from './novel'

export type EpisodeStatus = 'draft' | 'published'

/** An Episode (data-model.md §episodes). `body` is plain text. */
export interface Episode {
  id: string
  novelId: string
  chapterId: string | null
  episodeNo: number
  orderIndex: number
  title: string
  body: string
  charCount: number
  status: EpisodeStatus
  visibility: Visibility | null
  contentState: ContentState
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Lightweight row for table-of-contents / studio listings. */
export interface EpisodeSummary {
  id: string
  episodeNo: number
  title: string
  status: EpisodeStatus
  charCount: number
  publishedAt: Date | null
}
