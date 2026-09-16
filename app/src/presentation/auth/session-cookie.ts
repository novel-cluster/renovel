import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from '@/config/env'

/**
 * Session cookie handling (auth.md §1.5). `__Host-` prefix in prod forces
 * Secure + Path=/ + no Domain; dev over HTTP cannot use it.
 */
const COOKIE_NAME = env.isProd ? '__Host-renovel_session' : 'renovel_session'

export function getSessionToken(c: Context): string | null {
  return getCookie(c, COOKIE_NAME) ?? null
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date): void {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}
