import { ValidationError } from '@/shared/errors/app-error'

// Deliberately permissive: real validity is proven by delivery, not regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Login identifier (auth.md §1.2). Stored lower-cased in a `citext` column. */
export class Email {
  private constructor(readonly value: string) {}

  static create(input: string): Email {
    const normalized = input.trim().toLowerCase()
    if (!EMAIL_RE.test(normalized)) {
      throw new ValidationError('メールアドレスの形式が正しくありません')
    }
    return new Email(normalized)
  }

  toString(): string {
    return this.value
  }
}
