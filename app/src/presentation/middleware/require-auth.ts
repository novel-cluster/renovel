import type { Context, Next } from 'hono'
import type { AppEnv } from '@/presentation/env'

/**
 * Guards login-required routes (auth.md §2.2, §4.3). API paths get 401; HTML
 * navigations are redirected to the login page carrying a safe `redirect` back.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  if (c.get('user')) return next()

  if (c.req.path.startsWith('/api')) {
    return c.json({ error: 'unauthorized', message: 'ログインが必要です' }, 401)
  }
  const redirect = encodeURIComponent(c.req.path)
  return c.redirect(`/login?redirect=${redirect}`)
}
