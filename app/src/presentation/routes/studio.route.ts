import { Hono } from 'hono'
import { getNovelAnalytics } from '@/presentation/controllers/analytics.controller'
import {
  getCollaborators,
  postInviteCollaborator,
  postRemoveCollaborator,
} from '@/presentation/controllers/collaboration.controller'
import {
  getEditor,
  postPublishEpisode,
  postSaveEpisode,
} from '@/presentation/controllers/editor.controller'
import {
  getNewNovel,
  getNovelDashboard,
  getStudio,
  postCreateEpisode,
  postCreateNovel,
  postUpdateNovel,
} from '@/presentation/controllers/studio.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'

/** Author studio (routing.md §3.3). Mounted at `/studio`, login required. */
export const studioRoutes = new Hono<AppEnv>()

studioRoutes.use('*', requireAuth)
studioRoutes.get('/', getStudio)
studioRoutes.get('/novels/new', getNewNovel)
studioRoutes.post('/novels', postCreateNovel)
studioRoutes.get('/novels/:novelId', getNovelDashboard)
studioRoutes.post('/novels/:novelId', postUpdateNovel)
studioRoutes.get('/novels/:novelId/analytics', getNovelAnalytics)
studioRoutes.get('/novels/:novelId/collaborators', getCollaborators)
studioRoutes.post('/novels/:novelId/collaborators', postInviteCollaborator)
studioRoutes.post('/novels/:novelId/collaborators/remove', postRemoveCollaborator)
studioRoutes.post('/novels/:novelId/episodes', postCreateEpisode)
studioRoutes.get('/novels/:novelId/episodes/:episodeId', getEditor)
studioRoutes.post('/novels/:novelId/episodes/:episodeId', postSaveEpisode)
studioRoutes.post('/novels/:novelId/episodes/:episodeId/publish', postPublishEpisode)
