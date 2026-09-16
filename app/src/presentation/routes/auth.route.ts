import { Hono } from 'hono'
import {
  getLogin,
  getSignup,
  postLogin,
  postLogout,
  postSignup,
} from '@/presentation/controllers/auth.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'

/** Auth routes (routing.md §3.6). Mounted at `/`. */
export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/login', getLogin)
authRoutes.post('/login', postLogin)
authRoutes.get('/signup', getSignup)
authRoutes.post('/signup', postSignup)
authRoutes.post('/logout', requireAuth, postLogout)
