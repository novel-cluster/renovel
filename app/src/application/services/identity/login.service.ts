import type { SessionRepository } from '@/domain/identity/repositories/session-repository'
import type { UserRepository } from '@/domain/identity/repositories/user-repository'
import type { PasswordHasher } from '@/domain/identity/services/password-hasher'
import { ForbiddenError, UnauthorizedError } from '@/shared/errors/app-error'
import { issueSession } from './session-issuer'

export interface LoginInput {
  email: string
  password: string
  ip?: string | null
  userAgent?: string | null
}

export interface LoginResult {
  userId: string
  sessionToken: string
  expiresAt: Date
}

/**
 * Email+password login (auth.md §1.2, §6). Returns an identical error whether
 * the email is unknown or the password is wrong, and always runs a hash verify
 * (even for unknown users, via the hasher's null-hash path) to avoid a timing
 * oracle.
 */
export class LoginService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase()
    const creds = await this.users.findCredentialsByEmail(email)

    const ok = await this.hasher.verify(input.password, creds?.passwordHash ?? null)
    if (!creds || !ok) throw new UnauthorizedError('メールアドレスまたはパスワードが違います')
    if (creds.status === 'banned') {
      throw new ForbiddenError('このアカウントは利用できません')
    }

    const { token, expiresAt } = await issueSession(this.sessions, creds.id, {
      ip: input.ip,
      userAgent: input.userAgent,
    })
    return { userId: creds.id, sessionToken: token, expiresAt }
  }
}
