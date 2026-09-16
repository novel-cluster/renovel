import { ValidationError } from '@/shared/errors/app-error'

const MIN_LENGTH = 8

/**
 * Raw (plaintext) password at registration. Enforces the length policy
 * (auth.md §1.2) and never leaves the request — it is immediately hashed.
 * Breached-password checks are a future hardening step.
 */
export class RawPassword {
  private constructor(readonly value: string) {}

  static create(input: string): RawPassword {
    if (input.length < MIN_LENGTH) {
      throw new ValidationError('パスワードは8文字以上にしてください')
    }
    return new RawPassword(input)
  }
}
