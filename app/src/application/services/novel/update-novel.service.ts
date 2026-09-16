import type {
  ContentState,
  Genre,
  Novel,
  PublicationStatus,
  Visibility,
} from '@/domain/novel/entities/novel'
import type { NovelRepository, NovelUpdate } from '@/domain/novel/repositories/novel-repository'
import { NotFoundError, ValidationError } from '@/shared/errors/app-error'
import { ensureNovelOwner } from './ownership'

export interface UpdateNovelInput {
  actorUserId: string
  novelId: string
  title?: string
  catchphrase?: string | null
  description?: string | null
  genre?: Genre | null
  visibility?: Visibility
  publicationStatus?: PublicationStatus
  contentState?: ContentState
  contentWarnings?: string[]
}

/** Update Novel settings (auth.md §3.1 — owner only). */
export class UpdateNovelService {
  constructor(private readonly novels: NovelRepository) {}

  async execute(input: UpdateNovelInput): Promise<Novel> {
    const novel = await this.novels.findById(input.novelId)
    if (!novel) throw new NotFoundError('作品が見つかりません')
    ensureNovelOwner(novel, input.actorUserId)

    const patch: NovelUpdate = {}
    if (input.title !== undefined) {
      const title = input.title.trim()
      if (!title) throw new ValidationError('タイトルを入力してください')
      patch.title = title
    }
    if (input.catchphrase !== undefined) patch.catchphrase = blankToNull(input.catchphrase)
    if (input.description !== undefined) patch.description = blankToNull(input.description)
    if (input.genre !== undefined) patch.genre = input.genre
    if (input.publicationStatus !== undefined) patch.publicationStatus = input.publicationStatus
    if (input.contentState !== undefined) patch.contentState = input.contentState
    if (input.contentWarnings !== undefined) patch.contentWarnings = input.contentWarnings
    if (input.visibility !== undefined) {
      patch.visibility = input.visibility
      // First time it becomes Public, stamp the Novel's publish date (data-model.md).
      if (input.visibility === 'public' && !novel.publishedAt) patch.publishedAt = new Date()
    }

    return this.novels.update(novel.id, patch)
  }
}

function blankToNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length ? trimmed : null
}
