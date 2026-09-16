import type { Novel } from '@/domain/novel/entities/novel'
import { ForbiddenError } from '@/shared/errors/app-error'

/**
 * Phase 2 authorization: only the Novel author may manage it. Collaborator roles
 * (auth.md §3.1) extend this in Phase 7. `/studio/*` operations use IDs, so an
 * unauthorized actor gets 403 (existence is not secret here).
 */
export function ensureNovelOwner(novel: Novel, actorUserId: string): void {
  if (novel.authorId !== actorUserId) {
    throw new ForbiddenError('この作品を操作する権限がありません')
  }
}

/** Number of code points (so surrogate-pair characters count as one). */
export function countChars(text: string): number {
  return [...text].length
}
