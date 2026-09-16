import type { Hono } from 'hono'
import { getHome } from '@/presentation/controllers/home.controller'
import { getEpisodePage, getNovelPage } from '@/presentation/controllers/novel-read.controller'
import { getProfile } from '@/presentation/controllers/profile.controller'
import type { AppEnv } from '@/presentation/env'
import { authRoutes } from './auth.route'
import { healthRoutes } from './health.route'
import { libraryRoutes } from './library.route'
import { notificationsRoutes } from './notifications.route'
import { settingsRoutes } from './settings.route'
import { socialRoutes } from './social.route'
import { studioRoutes } from './studio.route'

const HANDLE = '@[A-Za-z0-9_]{3,30}'

/**
 * Route registration. Each feature area gets its own sub-router mounted here;
 * controllers stay thin and delegate to application services.
 */
export function registerRoutes(app: Hono<AppEnv>) {
  app.get('/', getHome)
  app.route('/health', healthRoutes)
  app.route('/', authRoutes)
  app.route('/settings', settingsRoutes)
  app.route('/studio', studioRoutes)
  app.route('/library', libraryRoutes)
  app.route('/notifications', notificationsRoutes)
  app.route('/', socialRoutes)

  // Public reading. Hono only recognizes a param at a segment start, so the whole
  // `@{handle}` segment is one regex param; controllers strip the `@`.
  app.get(`/:handle{${HANDLE}}`, getProfile)
  app.get(`/:handle{${HANDLE}}/:slug`, getNovelPage)
  app.get(`/:handle{${HANDLE}}/:slug/episodes/:episodeNo{[0-9]+}`, getEpisodePage)
}
