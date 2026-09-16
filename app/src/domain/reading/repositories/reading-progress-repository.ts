export interface RecordProgressInput {
  userId: string
  novelId: string
  episodeId: string
  position?: number
  isCompleted?: boolean
}

/**
 * Per-user reading progress (data-model.md §reading). Private to the user
 * (PRD §58) — never exposed to authors or others.
 */
export interface ReadingProgressRepository {
  /** Upsert the progress row for (user, episode) and bump `last_read_at`. */
  record(input: RecordProgressInput): Promise<void>
  /** episode_no of the user's most recently read episode in a novel, or null. */
  latestEpisodeNoForNovel(userId: string, novelId: string): Promise<number | null>
  /** Whether the user has opened/read this episode (comment read-gate, PRD §20.4). */
  hasRead(userId: string, episodeId: string): Promise<boolean>
}
