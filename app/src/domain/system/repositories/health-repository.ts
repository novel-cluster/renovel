/**
 * Health check port.
 *
 * Phase 0 uses this trivial repository to prove the layering seam
 * (Application → Domain interface → Infrastructure impl → Postgres). Real
 * domains follow the same shape starting Phase 1.
 */
export interface HealthRepository {
  /** Returns true if the database answered a round-trip query. */
  ping(): Promise<boolean>
}
