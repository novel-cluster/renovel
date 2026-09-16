import type { Context, Next } from 'hono'
import { getSessionToken } from '@/presentation/auth/session-cookie'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { hashToken } from '@/shared/utils/token'

/**
 * Resolves the session cookie into `c.get("user")` / `c.get("session")` on every
 * request (auth.md §2.1). Guests and invalid/expired/banned sessions get `null`.
 * This middleware does NO authorization — that lives in application services.
 */
export async function authContext(c: Context<AppEnv>, next: Next) {
  const token = getSessionToken(c)
  const found = token ? await container.sessionRepository.findAuthenticated(hashToken(token)) : null

  if (found) {
    c.set('user', found.user)
    c.set('session', { id: found.session.id, expiresAt: found.session.expiresAt })
  } else {
    c.set('user', null)
    c.set('session', null)
  }
  return next()
}
