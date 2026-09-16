export type Visibility = 'public' | 'unlisted' | 'private'
export type PublicationStatus = 'ongoing' | 'completed' | 'hiatus'
export type Genre =
  | 'fantasy'
  | 'sf'
  | 'romance'
  | 'mystery'
  | 'horror'
  | 'literary'
  | 'essay'
  | 'other'
export type ContentState = 'visible' | 'hidden'

/**
 * A Novel (data-model.md §novel). Visibility (who can see) and Publication
 * Status (ongoing/completed/hiatus) are orthogonal (PRD §8–9).
 */
export interface Novel {
  id: string
  slug: string
  authorId: string
  title: string
  catchphrase: string | null
  description: string | null
  genre: Genre | null
  visibility: Visibility
  publicationStatus: PublicationStatus
  contentState: ContentState
  contentWarnings: string[]
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
