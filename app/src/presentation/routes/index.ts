import type { Hono } from 'hono'
import { getHome } from '@/presentation/controllers/home.controller'
import { getProfile } from '@/presentation/controllers/profile.controller'
import type { AppEnv } from '@/presentation/env'
import { authRoutes } from './auth.route'
import { healthRoutes } from './health.route'
import { settingsRoutes } from './settings.route'

/**
 * Route registration. Each feature area gets its own sub-router mounted here;
 * controllers stay thin and delegate to application services.
 */
export function registerRoutes(app: Hono<AppEnv>) {
  app.get('/', getHome)
  app.route('/health', healthRoutes)
  app.route('/', authRoutes)
  // `@handle` profile. Hono only recognizes a param at a segment start, so the
  // whole `@{handle}` segment is one regex param; the controller strips the `@`.
  app.get('/:handle{@[A-Za-z0-9_]{3,30}}', getProfile)
  app.route('/settings', settingsRoutes)
}
