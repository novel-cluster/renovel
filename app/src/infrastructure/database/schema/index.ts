/**
 * Drizzle schema barrel.
 *
 * Tables are added per domain. Each domain gets its own schema file here that is
 * re-exported below so both the Drizzle client and drizzle-kit see the full
 * schema. Shared helpers live in `_shared.ts`, enums in `enums.ts`.
 *
 * Keep Analytics tables in separate files/schemas from transactional tables
 * (see docs/design/overview/architecture.md §7, data-model.md §1.7).
 */

export * from './analytics'
export * from './collaboration'
export * from './discovery'
export * from './enums'
export * from './fork'
export * from './identity'
export * from './notification'
export * from './novel'
export * from './reading'
export * from './social'
export * from './writing'
