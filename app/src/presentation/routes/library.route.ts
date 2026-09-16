import { Hono } from 'hono'
import {
  getLibrary,
  postRemoveLibrary,
  postSetLibrary,
} from '@/presentation/controllers/library.controller'
import type { AppEnv } from '@/presentation/env'
import { requireAuth } from '@/presentation/middleware/require-auth'

/** Reader library (PRD §19). Mounted at `/library`, login required. */
export const libraryRoutes = new Hono<AppEnv>()

libraryRoutes.use('*', requireAuth)
libraryRoutes.get('/', getLibrary)
libraryRoutes.post('/', postSetLibrary)
libraryRoutes.post('/remove', postRemoveLibrary)
