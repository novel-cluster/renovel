import type { Context } from 'hono'
import { AppError } from '@/shared/errors/app-error'

/**
 * Central error handler wired via `app.onError`. Known {@link AppError}s become
 * structured JSON with their status; anything else is logged and returned as a
 * generic 500 (no internals leaked).
 */
export function onError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message }, err.status)
  }
  console.error('[unhandled]', err)
  return c.json({ error: 'internal_error', message: 'Internal Server Error' }, 500)
}
