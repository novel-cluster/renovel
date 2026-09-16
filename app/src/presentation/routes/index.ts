import type { Hono } from 'hono'
import { postAnalyticsEvent } from '@/presentation/controllers/analytics.controller'
import {
  postFork,
  postRespondInvitation,
} from '@/presentation/controllers/collaboration.controller'
import { getRanking, getSearch } from '@/presentation/controllers/discovery.controller'
import { getHome } from '@/presentation/controllers/home.controller'
import {
  getReportForm,
  postBlock,
  postMute,
  postReport,
} from '@/presentation/controllers/moderation.controller'
import { getEpisodePage, getNovelPage } from '@/presentation/controllers/novel-read.controller'
import { getProfile } from '@/presentation/controllers/profile.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'
import { adminRoutes } from './admin.route'
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
  app.get('/search', getSearch)
  app.get('/ranking', getRanking)
  app.post('/api/analytics/events', postAnalyticsEvent)
  app.route('/health', healthRoutes)
  app.route('/', authRoutes)
  app.route('/settings', settingsRoutes)
  app.route('/studio', studioRoutes)
  app.route('/library', libraryRoutes)
  app.route('/notifications', notificationsRoutes)
  app.route('/', socialRoutes)
  app.route('/admin', adminRoutes)
  app.post('/invitations/:invitationId/respond', requireAuth, postRespondInvitation)
  app.get('/report', requireAuth, getReportForm)
  app.post('/report', requireAuth, postReport)
  app.post('/users/:userId/block', requireAuth, postBlock)
  app.post('/users/:userId/mute', requireAuth, postMute)

  // Public reading. Hono only recognizes a param at a segment start, so the whole
  // `@{handle}` segment is one regex param; controllers strip the `@`.
  app.get(`/:handle{${HANDLE}}`, getProfile)
  app.get(`/:handle{${HANDLE}}/:slug`, getNovelPage)
  app.post(`/:handle{${HANDLE}}/:slug/fork`, requireAuth, postFork)
  app.get(`/:handle{${HANDLE}}/:slug/episodes/:episodeNo{[0-9]+}`, getEpisodePage)
}
