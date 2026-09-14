import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/config/env'
import * as schema from '@/infrastructure/database/schema'

/**
 * Single shared Postgres connection + Drizzle client.
 *
 * This is the ONE place that knows about the DB driver. Repositories in
 * `infrastructure/database/repositories` use `db`; the domain/application layers
 * only ever see repository interfaces.
 */
const queryClient = postgres(env.databaseUrl, { max: 10 })

export const db = drizzle(queryClient, { schema })

export type DB = typeof db
