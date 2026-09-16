import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Postgres enum types (data-model.md §3.0). Enums are added per phase; only add
 * values over time — never remove or reorder (data-model.md §1.2).
 */
export const userStatus = pgEnum('user_status', ['active', 'suspended', 'banned'])
