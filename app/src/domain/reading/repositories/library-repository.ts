import type { LibraryItem, LibraryState } from '../entities/reading'

/** Reader's library (data-model.md §reading, PRD §19). One entry per novel. */
export interface LibraryRepository {
  /** Upsert the entry for (user, novel) to the given state. */
  setState(userId: string, novelId: string, state: LibraryState): Promise<void>
  remove(userId: string, novelId: string): Promise<void>
  find(userId: string, novelId: string): Promise<LibraryState | null>
  /** Entries joined with novel/author info for the library page. */
  listByUser(userId: string): Promise<LibraryItem[]>
}
