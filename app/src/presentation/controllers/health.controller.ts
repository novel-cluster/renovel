import type { Context } from 'hono'
import { container } from '@/presentation/container'

/**
 * Thin controller: no business logic. Delegates to the HealthService and maps
 * the result to a status code (503 when degraded).
 */
export async function getHealth(c: Context) {
  const result = await container.healthService.check()
  return c.json(result, result.status === 'ok' ? 200 : 503)
}
