import type { Hono } from 'hono'
import { getHome } from '@/presentation/controllers/home.controller'
import { healthRoutes } from './health.route'

/**
 * Route registration. Each feature area gets its own sub-router mounted here;
 * controllers stay thin and delegate to application services.
 */
export function registerRoutes(app: Hono) {
  app.get('/', getHome)
  app.route('/health', healthRoutes)
}
