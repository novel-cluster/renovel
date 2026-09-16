export type LibraryState = 'reading' | 'read_later' | 'completed' | 'favorite'

/** A library entry enriched with the novel it points to (for the library page). */
export interface LibraryItem {
  novelId: string
  slug: string
  title: string
  authorHandle: string
  state: LibraryState
}
