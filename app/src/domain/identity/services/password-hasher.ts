/**
 * Password hashing port (auth.md §1.2, §6). Keeps the Argon2id implementation
 * (Bun) out of the application layer so use cases stay unit-testable with a fake.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>
  /**
   * Verify a password. When `hash` is null (no such user, or an OAuth-only
   * account) implementations must still spend comparable time to avoid a timing
   * oracle (auth.md §6) and return false.
   */
  verify(plain: string, hash: string | null): Promise<boolean>
}
