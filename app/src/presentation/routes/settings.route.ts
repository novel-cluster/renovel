import { Hono } from 'hono'
import {
  getAccountSettings,
  postAccountSettings,
} from '@/presentation/controllers/account-settings.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'

/** Account settings (routing.md §3.6). Mounted at `/settings`, login required. */
export const settingsRoutes = new Hono<AppEnv>()

settingsRoutes.use('*', requireAuth)
settingsRoutes.get('/account', getAccountSettings)
settingsRoutes.post('/account', postAccountSettings)
