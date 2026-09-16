import type { Context, Next } from 'hono'
import type { AppEnv } from '@/presentation/env'

interface Bucket {
  count: number
  resetAt: number
}

// In-memory fixed-window limiter (auth.md §6). Fine for a single instance; move
// to Redis when scaling to multiple instances (infrastructure.md §3.2).
const store = new Map<string, Bucket>()

function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  return xff ? (xff.split(',')[0]?.trim() ?? 'local') : 'local'
}

/**
 * Throttles sensitive endpoints (login/signup, auth.md §6). Keyed by a prefix +
 * client IP; over the limit returns 429.
 */
export function rateLimit(opts: { windowMs: number; max: number; prefix: string }) {
  return async (c: Context<AppEnv>, next: Next) => {
    const key = `${opts.prefix}:${clientIp(c)}`
    const now = Date.now()
    const bucket = store.get(key)
    if (!bucket || bucket.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs })
      return next()
    }
    bucket.count += 1
    if (bucket.count > opts.max) {
      return c.json(
        {
          error: 'rate_limited',
          message: '試行回数が多すぎます。しばらくしてからお試しください。',
        },
        429,
      )
    }
    return next()
  }
}
