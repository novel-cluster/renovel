import type { Context } from 'hono'
import type { AppEnv } from '@/presentation/env'
import { HomePage } from '@/presentation/views/home'
import { renderPage } from '@/presentation/views/render'

/** Renders the SSR home page. */
export function getHome(c: Context<AppEnv>) {
  return renderPage(c, <HomePage user={c.get('user')} />)
}
