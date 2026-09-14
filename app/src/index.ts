import { env } from '@/config/env'
import { createApp } from '@/presentation/app'

const app = createApp()

console.log(`ReNovel listening on http://localhost:${env.port} [${env.nodeEnv}]`)

export default {
  port: env.port,
  fetch: app.fetch,
}
