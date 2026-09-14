import { describe, expect, it } from 'bun:test'
import type { HealthRepository } from '@/domain/system/repositories/health-repository'
import { HealthService } from './health.service'

const fakeRepo = (up: boolean): HealthRepository => ({
  ping: async () => up,
})

describe('HealthService', () => {
  it('reports ok when the database is up', async () => {
    const service = new HealthService(fakeRepo(true))
    expect(await service.check()).toEqual({ status: 'ok', database: 'up' })
  })

  it('reports degraded when the database is down', async () => {
    const service = new HealthService(fakeRepo(false))
    expect(await service.check()).toEqual({ status: 'degraded', database: 'down' })
  })
})
