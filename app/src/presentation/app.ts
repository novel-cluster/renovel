import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { onError } from './middleware/error.middleware'
import { registerRoutes } from './routes'

/**
 * Builds the Hono application: global middleware, static assets, routes, and
 * error handling. The entrypoint (src/index.ts) only serves what this returns.
 */
export function createApp() {
  const app = new Hono()

  app.use('*', logger())
  app.use('*', secureHeaders())

  // Tailwind build output + public assets.
  app.use('/styles.css', serveStatic({ path: './public/styles.css' }))
  app.use('/static/*', serveStatic({ root: './public' }))

  registerRoutes(app)

  app.notFound((c) => c.json({ error: 'not_found', message: 'Not Found' }, 404))
  app.onError(onError)

  return app
}
