import { randomBytes } from 'node:crypto'
import { ValidationError } from '@/shared/errors/app-error'

const CUSTOM_RE = /^[a-z0-9-]{3,50}$/

// Reserved path words that would collide with `/@{handle}/{slug}/...` routes
// (routing.md §2.2).
const RESERVED = new Set([
  'new',
  'edit',
  'episodes',
  'settings',
  'analytics',
  'proposals',
  'fork',
  'continue',
  'reviews',
])

/**
 * Novel slug (routing.md §2.2). Auto-generated as a short random ASCII value at
 * creation (titles are mostly Japanese, so we do not slugify the title); authors
 * may set a custom slug later.
 */
export const NovelSlug = {
  /** 8-char base36 random slug. */
  generate(): string {
    return Array.from(randomBytes(8))
      .map((b) => (b % 36).toString(36))
      .join('')
  },

  /** Validate an author-supplied custom slug. */
  createCustom(input: string): string {
    const slug = input.trim().toLowerCase()
    if (!CUSTOM_RE.test(slug)) {
      throw new ValidationError('slug は3〜50文字の英小文字・数字・ハイフンで入力してください')
    }
    if (RESERVED.has(slug)) {
      throw new ValidationError('その slug は予約語のため使用できません')
    }
    return slug
  },
}
