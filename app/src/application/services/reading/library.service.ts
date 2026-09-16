import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import type { LibraryItem, LibraryState } from '@/domain/reading/entities/reading'
import type { LibraryRepository } from '@/domain/reading/repositories/library-repository'
import { NotFoundError, ValidationError } from '@/shared/errors/app-error'

const STATES: LibraryState[] = ['reading', 'read_later', 'completed', 'favorite']

export function isLibraryState(value: unknown): value is LibraryState {
  return typeof value === 'string' && (STATES as string[]).includes(value)
}

/** Add/move a novel in the reader's library (PRD §19). */
export class SetLibraryStateService {
  constructor(
    private readonly library: LibraryRepository,
    private readonly novels: NovelRepository,
  ) {}

  async execute(input: { userId: string; novelId: string; state: LibraryState }): Promise<void> {
    if (!isLibraryState(input.state)) throw new ValidationError('不正な状態です')
    const novel = await this.novels.findById(input.novelId)
    // Hide existence of private novels the user cannot see (auth.md §4.3).
    if (!novel || (novel.visibility === 'private' && novel.authorId !== input.userId)) {
      throw new NotFoundError('作品が見つかりません')
    }
    await this.library.setState(input.userId, input.novelId, input.state)
  }
}

export class RemoveFromLibraryService {
  constructor(private readonly library: LibraryRepository) {}

  execute(userId: string, novelId: string): Promise<void> {
    return this.library.remove(userId, novelId)
  }
}

export class GetLibraryStateService {
  constructor(private readonly library: LibraryRepository) {}

  execute(userId: string, novelId: string): Promise<LibraryState | null> {
    return this.library.find(userId, novelId)
  }
}

export class ListLibraryService {
  constructor(private readonly library: LibraryRepository) {}

  execute(userId: string): Promise<LibraryItem[]> {
    return this.library.listByUser(userId)
  }
}
