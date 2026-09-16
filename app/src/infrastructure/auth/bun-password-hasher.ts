import type { PasswordHasher } from '@/domain/identity/services/password-hasher'

/**
 * Argon2id password hashing via Bun's native `Bun.password` (auth.md §1.2).
 * This is the only place that knows the hashing algorithm.
 */
export class BunPasswordHasher implements PasswordHasher {
  private readonly algorithm = 'argon2id'
  
  async hash(plain: string): Promise<string> {
    return Bun.password.hash(plain, { algorithm: this.algorithm })
  }

  async verify(plain: string, hash: string | null): Promise<boolean> {
    if (hash === null) {
      // No such user / OAuth-only account: still spend comparable time so the
      // response timing does not reveal whether the account exists (auth.md §6).
      await Bun.password.hash(plain, { algorithm: this.algorithm })
      return false
    }
    try {
      return await Bun.password.verify(plain, hash)
    } catch {
      return false
    }
  }
}
