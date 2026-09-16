import type { ReadingProgressRepository } from '@/domain/reading/repositories/reading-progress-repository'

/** Records that a user read an episode (PRD §18). Fire-and-forget from the read path. */
export class RecordReadingProgressService {
  constructor(private readonly progress: ReadingProgressRepository) {}

  execute(input: {
    userId: string
    novelId: string
    episodeId: string
    isCompleted?: boolean
  }): Promise<void> {
    return this.progress.record(input)
  }
}

/** Resolves the "continue reading" target: the user's latest episode in a novel. */
export class ResumeReadingService {
  constructor(private readonly progress: ReadingProgressRepository) {}

  execute(userId: string, novelId: string): Promise<number | null> {
    return this.progress.latestEpisodeNoForNovel(userId, novelId)
  }
}
