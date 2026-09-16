export type UserStatus = 'active' | 'suspended' | 'banned'

export interface ExternalLink {
  label: string
  url: string
}

/**
 * A user account + public profile (data-model.md §identity). Reader and author
 * are the same account (PRD §6). Secrets (`password_hash`) never live on this
 * model — they are only read via {@link UserRepository.findCredentialsByEmail}.
 */
export interface User {
  id: string
  handle: string
  displayName: string
  iconUrl: string | null
  bio: string | null
  externalLinks: ExternalLink[]
  email: string | null
  status: UserStatus
  createdAt: Date
}
