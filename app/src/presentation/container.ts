import { HealthService } from '@/application/services/health.service'
import { DrizzleHealthRepository } from '@/infrastructure/database/repositories/health-repository.drizzle'

/**
 * Composition root.
 *
 * The single place where concrete infrastructure is wired into application
 * services. Controllers import ready-made services from here instead of
 * `new`-ing repositories themselves, keeping the dependency direction clean.
 * Phase 0 uses plain manual wiring; introduce a DI container only if this grows.
 */
export const container = {
  healthService: new HealthService(new DrizzleHealthRepository()),
} as const

export type Container = typeof container
