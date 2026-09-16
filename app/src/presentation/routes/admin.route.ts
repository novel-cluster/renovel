import { Hono } from 'hono'
import {
  getAdmin,
  postAdminAction,
  postResolveReport,
} from '@/presentation/controllers/moderation.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAdmin } from '@/presentation/middleware/require-admin'

/** Admin moderation (PRD §37). Mounted at `/admin`, admin only. */
export const adminRoutes = new Hono<AppEnv>()

adminRoutes.use('*', requireAdmin)
adminRoutes.get('/', getAdmin)
adminRoutes.post('/reports/:id/resolve', postResolveReport)
adminRoutes.post('/actions', postAdminAction)
