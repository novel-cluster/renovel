import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { env } from '@/config/env'

/**
 * Anonymous visitor id for unique-visitor counting (analytics.md). Not tied to
 * identity; used only for aggregation (PRD §58).
 */
export function visitorId(c: Context): string {
  const existing = getCookie(c, 'rn_vid')
  if (existing) return existing
  const id = crypto.randomUUID()
  setCookie(c, 'rn_vid', id, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return id
}
