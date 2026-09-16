import type { Context, Next } from 'hono'
import type { AppEnv } from '@/presentation/env'

/** Guards admin routes (moderation.md). Non-admins get 404 to hide the surface. */
export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = c.get('user')
  if (!user) return c.redirect('/login')
  if (!user.isAdmin) return c.json({ error: 'not_found', message: 'Not Found' }, 404)
  return next()
}
