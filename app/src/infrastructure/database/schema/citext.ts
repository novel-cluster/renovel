import { customType } from 'drizzle-orm/pg-core'

/**
 * `citext` (case-insensitive text) column type. Used for `users.email` so
 * uniqueness/lookup are case-insensitive without app-side normalization
 * (data-model.md §identity). Requires the `citext` extension — the generated
 * migration must `CREATE EXTENSION IF NOT EXISTS citext`.
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})
