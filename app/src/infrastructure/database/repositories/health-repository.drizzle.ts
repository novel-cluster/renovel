import { sql } from 'drizzle-orm'
import type { HealthRepository } from '@/domain/system/repositories/health-repository'
import { db } from '@/infrastructure/database/drizzle/client'

/**
 * Drizzle-backed implementation of {@link HealthRepository}. Runs a `SELECT 1`
 * to confirm the connection is alive. Swallows errors and reports `false` so a
 * down DB degrades the health endpoint rather than crashing it.
 */
export class DrizzleHealthRepository implements HealthRepository {
  async ping(): Promise<boolean> {
    try {
      await db.execute(sql`select 1`)
      return true
    } catch {
      return false
    }
  }
}
