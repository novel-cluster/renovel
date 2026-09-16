import type { ExternalLink, User } from '@/domain/identity/entities/user'
import type { ProfileUpdate, UserRepository } from '@/domain/identity/repositories/user-repository'
import { ValidationError } from '@/shared/errors/app-error'

const MAX_LINKS = 5
const MAX_DISPLAY_NAME = 50
const MAX_BIO = 2000

export interface UpdateProfileInput {
  userId: string
  displayName?: string
  bio?: string | null
  externalLinks?: ExternalLink[]
}

/**
 * Edit the current user's profile (PRD §6). Only supplied fields change;
 * validation mirrors data-model.md (max 5 links). Handle changes are out of
 * scope for this slice (they invalidate old URLs — routing.md §2.1).
 */
export class UpdateProfileService {
  constructor(private readonly users: UserRepository) {}

  async execute(input: UpdateProfileInput): Promise<User> {
    const patch: ProfileUpdate = {}

    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim()
      if (!displayName) throw new ValidationError('表示名を入力してください')
      if (displayName.length > MAX_DISPLAY_NAME) {
        throw new ValidationError('表示名は50文字以内で入力してください')
      }
      patch.displayName = displayName
    }

    if (input.bio !== undefined) {
      const bio = (input.bio ?? '').trim()
      if (bio.length > MAX_BIO)
        throw new ValidationError('自己紹介は2000文字以内で入力してください')
      patch.bio = bio.length ? bio : null
    }

    if (input.externalLinks !== undefined) {
      patch.externalLinks = normalizeLinks(input.externalLinks)
    }

    return this.users.updateProfile(input.userId, patch)
  }
}

function normalizeLinks(links: ExternalLink[]): ExternalLink[] {
  if (links.length > MAX_LINKS) {
    throw new ValidationError('外部リンクは最大5件までです')
  }
  return links.map((link) => {
    const label = link.label.trim()
    const url = link.url.trim()
    if (!label || !url) throw new ValidationError('リンクのラベルとURLを入力してください')
    if (!/^https?:\/\//.test(url)) {
      throw new ValidationError('リンクURLは http(s):// で始めてください')
    }
    return { label, url }
  })
}
