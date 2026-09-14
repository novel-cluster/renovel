import { defineConfig } from 'drizzle-kit'

const DEFAULT_DATABASE_URL = 'postgres://renovel:renovel@localhost:5432/renovel'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
