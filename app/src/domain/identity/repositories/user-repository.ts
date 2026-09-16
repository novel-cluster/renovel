import type { ExternalLink, User, UserStatus } from '../entities/user'

export interface NewUser {
  handle: string
  displayName: string
  email: string | null
  passwordHash: string | null
}

export interface ProfileUpdate {
  displayName?: string
  bio?: string | null
  iconUrl?: string | null
  externalLinks?: ExternalLink[]
}

/** Credentials projection used only by the login use case (auth.md §1.2). */
export interface UserCredentials {
  id: string
  status: UserStatus
  passwordHash: string | null
}

/**
 * identity persistence port. The Drizzle implementation lives in
 * infrastructure; domain/application depend only on this interface
 * (architecture.md §2). Lookups exclude soft-deleted users.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByHandle(handle: string): Promise<User | null>
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>
  handleExists(handle: string): Promise<boolean>
  emailExists(email: string): Promise<boolean>
  create(input: NewUser): Promise<User>
  updateProfile(id: string, patch: ProfileUpdate): Promise<User>
}
