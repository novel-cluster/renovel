import type { User, UserStatus } from '@/domain/identity/entities/user'
import type {
  NewSession,
  SessionRecord,
  SessionRepository,
} from '@/domain/identity/repositories/session-repository'
import type {
  NewUser,
  ProfileUpdate,
  UserCredentials,
  UserRepository,
} from '@/domain/identity/repositories/user-repository'
import type { PasswordHasher } from '@/domain/identity/services/password-hasher'

/** In-memory test doubles for the identity use cases. */

type StoredUser = User & { passwordHash: string | null }

function strip(u: StoredUser): User {
  const { passwordHash: _ignored, ...user } = u
  return user
}

export class FakeUserRepository implements UserRepository {
  readonly users: StoredUser[] = []
  private seq = 0

  seed(partial: Partial<StoredUser> & { handle: string; email: string | null }): StoredUser {
    const user: StoredUser = {
      id: `u${++this.seq}`,
      handle: partial.handle,
      displayName: partial.displayName ?? partial.handle,
      iconUrl: null,
      bio: null,
      externalLinks: [],
      email: partial.email,
      status: partial.status ?? 'active',
      createdAt: new Date(),
      passwordHash: partial.passwordHash ?? null,
    }
    this.users.push(user)
    return user
  }

  async findById(id: string): Promise<User | null> {
    const u = this.users.find((x) => x.id === id)
    return u ? strip(u) : null
  }

  async findByHandle(handle: string): Promise<User | null> {
    const u = this.users.find((x) => x.handle === handle)
    return u ? strip(u) : null
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const u = this.users.find((x) => x.email === email)
    return u ? { id: u.id, status: u.status, passwordHash: u.passwordHash } : null
  }

  async handleExists(handle: string): Promise<boolean> {
    return this.users.some((u) => u.handle === handle)
  }

  async emailExists(email: string): Promise<boolean> {
    return this.users.some((u) => u.email === email)
  }

  async create(input: NewUser): Promise<User> {
    return strip(this.seed({ ...input }))
  }

  async updateProfile(id: string, patch: ProfileUpdate): Promise<User> {
    const u = this.users.find((x) => x.id === id)
    if (!u) throw new Error('not found')
    Object.assign(u, patch)
    return strip(u)
  }
}

export class FakeSessionRepository implements SessionRepository {
  readonly created: NewSession[] = []
  readonly deletedTokenHashes: string[] = []

  async create(input: NewSession): Promise<SessionRecord> {
    this.created.push(input)
    return { id: `s${this.created.length}`, userId: input.userId, expiresAt: input.expiresAt }
  }

  async findAuthenticated() {
    return null
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.deletedTokenHashes.push(tokenHash)
  }

  async deleteByUserId(): Promise<void> {}
  async deleteExpired(): Promise<void> {}
}

export class FakeHasher implements PasswordHasher {
  verifyCalls = 0

  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`
  }

  async verify(plain: string, hash: string | null): Promise<boolean> {
    this.verifyCalls++
    return hash === `hashed:${plain}`
  }
}

export const activeStatus: UserStatus = 'active'
