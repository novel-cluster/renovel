import { Hono } from 'hono'
import {
  postComment,
  postLike,
  postNovelFollow,
  postReview,
  postStar,
  postUserFollow,
} from '@/presentation/controllers/social.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'

/**
 * ID-based social mutation endpoints (routing.md §5). Mounted at `/`, so
 * `requireAuth` is applied per-route (a `use('*')` here would leak onto every
 * page).
 */
export const socialRoutes = new Hono<AppEnv>()

socialRoutes.post('/episodes/:episodeId/like', requireAuth, postLike)
socialRoutes.post('/episodes/:episodeId/comments', requireAuth, postComment)
socialRoutes.post('/novels/:novelId/star', requireAuth, postStar)
socialRoutes.post('/novels/:novelId/follow', requireAuth, postNovelFollow)
socialRoutes.post('/novels/:novelId/reviews', requireAuth, postReview)
socialRoutes.post('/users/:userId/follow', requireAuth, postUserFollow)
