import { Hono } from 'hono'
import {
  getLogin,
  getSignup,
  postLogin,
  postLogout,
  postSignup,
} from '@/presentation/controllers/auth.controller'
import type { AppEnv } from '@/presentation/env'
import { rateLimit } from '@/presentation/middleware/rate-limit'
import { requireAuth } from '@/presentation/middleware/require-auth'

/** Auth routes (routing.md §3.6). Mounted at `/`. */
export const authRoutes = new Hono<AppEnv>()

// Throttle credential + signup attempts (auth.md §6).
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, prefix: 'login' })
const signupLimit = rateLimit({ windowMs: 60 * 60_000, max: 10, prefix: 'signup' })

authRoutes.get('/login', getLogin)
authRoutes.post('/login', loginLimit, postLogin)
authRoutes.get('/signup', getSignup)
authRoutes.post('/signup', signupLimit, postSignup)
authRoutes.post('/logout', requireAuth, postLogout)
