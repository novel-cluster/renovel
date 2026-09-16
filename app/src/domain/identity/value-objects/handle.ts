import { ValidationError } from '@/shared/errors/app-error'

const HANDLE_RE = /^[a-z0-9_]{3,30}$/

/**
 * User handle — the `/@{handle}` public identifier (data-model.md §identity,
 * routing.md §2.1). Lower-cased, 3–30 chars of `[a-z0-9_]`.
 */
export class Handle {
  private constructor(readonly value: string) {}

  static create(input: string): Handle {
    const normalized = input.trim().toLowerCase()
    if (!HANDLE_RE.test(normalized)) throw new ValidationError(
      'ハンドルは3〜30文字の英小文字・数字・アンダースコアで入力してください',
    )
    return new Handle(normalized)
  }

  toString(): string {
    return this.value
  }
}
