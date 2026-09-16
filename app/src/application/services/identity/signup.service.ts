import type { User } from '@/domain/identity/entities/user'
import type { SessionRepository } from '@/domain/identity/repositories/session-repository'
import type { UserRepository } from '@/domain/identity/repositories/user-repository'
import type { PasswordHasher } from '@/domain/identity/services/password-hasher'
import { Email } from '@/domain/identity/value-objects/email'
import { Handle } from '@/domain/identity/value-objects/handle'
import { RawPassword } from '@/domain/identity/value-objects/password'
import { ConflictError } from '@/shared/errors/app-error'
import { issueSession } from './session-issuer'

export interface SignupInput {
  handle: string
  displayName: string
  email: string
  password: string
  ip?: string | null
  userAgent?: string | null
}

export interface AuthResult {
  user: User
  sessionToken: string
  expiresAt: Date
}

/**
 * Register a new email+password account and start a session (auth.md §1.2, PRD §6).
 * Validation lives in the value objects; uniqueness is checked before hashing.
 */
export class SignupService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: SignupInput): Promise<AuthResult> {
    const handle = Handle.create(input.handle)
    const email = Email.create(input.email)
    RawPassword.create(input.password)
    const displayName = input.displayName.trim() || handle.value

    if (await this.users.handleExists(handle.value)) throw new ConflictError('このハンドルは既に使われています')
    if (await this.users.emailExists(email.value)) throw new ConflictError('このメールアドレスは既に登録されています')

    const passwordHash = await this.hasher.hash(input.password)
    const user = await this.users.create({
      handle: handle.value,
      displayName,
      email: email.value,
      passwordHash,
    })

    const { token, expiresAt } = await issueSession(this.sessions, user.id, {
      ip: input.ip,
      userAgent: input.userAgent,
    })
    return { user, sessionToken: token, expiresAt }
  }
}
