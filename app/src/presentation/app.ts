import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './env'
import { authContext } from './middleware/auth.middleware'
import { onError } from './middleware/error.middleware'
import { registerRoutes } from './routes'

/**
 * Builds the Hono application: global middleware, static assets, routes, and
 * error handling. The entrypoint (src/index.ts) only serves what this returns.
 */
export function createApp() {
  const app = new Hono<AppEnv>()

  app.use('*', logger())
  app.use('*', secureHeaders())
  // CSRF: Origin verification for state-changing requests (auth.md §5).
  app.use('*', csrf())

  // Tailwind build output + public assets (served before auth to skip session lookup).
  app.use('/styles.css', serveStatic({ path: './public/styles.css' }))
  app.use('/static/*', serveStatic({ root: './public' }))

  // Resolve the session cookie into c.get("user")/c.get("session") (auth.md §2.1).
  app.use('*', authContext)

  registerRoutes(app)

  app.notFound((c) => c.json({ error: 'not_found', message: 'Not Found' }, 404))
  app.onError(onError)

  return app
}
