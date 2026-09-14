/**
 * Drizzle schema barrel.
 *
 * Tables are added per domain, starting in Phase 1 (Identity). Each domain gets
 * its own schema file here (e.g. `identity.ts`, `novel.ts`) that is re-exported
 * below so both the Drizzle client and drizzle-kit see the full schema.
 *
 * Keep Analytics tables in separate files/schemas from transactional tables
 * (see docs/design/architecture.md §7).
 */

export {}
