import type { HealthRepository } from '@/domain/system/repositories/health-repository'

export interface HealthStatus {
  status: 'ok' | 'degraded'
  database: 'up' | 'down'
}

/**
 * Application service (use case): reports overall system health.
 *
 * Depends on the {@link HealthRepository} interface, not the Drizzle impl — so
 * it is unit-testable with a fake repo (see health.service.test.ts).
 */
export class HealthService {
  constructor(private readonly repo: HealthRepository) {}

  async check(): Promise<HealthStatus> {
    const dbUp = await this.repo.ping()
    return {
      status: dbUp ? 'ok' : 'degraded',
      database: dbUp ? 'up' : 'down',
    }
  }
}
