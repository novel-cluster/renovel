import { timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Shared column helpers (data-model.md §1.1–1.3). Every table uses these so the
 * PK strategy (UUIDv7, time-sortable) and audit columns stay uniform.
 *
 * `$defaultFn` is only invoked at insert time under the Bun runtime, so
 * referencing the Bun global here is safe for drizzle-kit generation (which
 * never calls the closure).
 */
export const pk = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => Bun.randomUUIDv7())

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/** `deleted_at IS NULL` = alive. Soft-delete targets are listed in data-model.md §1.6. */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
