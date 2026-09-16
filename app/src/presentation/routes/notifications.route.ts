import { Hono } from 'hono'
import { getNotifications } from '@/presentation/controllers/notifications.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'

/** In-app notifications (PRD §22). Mounted at `/notifications`, login required. */
export const notificationsRoutes = new Hono<AppEnv>()

notificationsRoutes.use('*', requireAuth)
notificationsRoutes.get('/', getNotifications)
