import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { HomePage } from '@/presentation/views/home'
import { renderPage } from '@/presentation/views/render'

/** Renders the SSR reader home (PRD §28). */
export async function getHome(c: Context<AppEnv>) {
  const viewer = c.get('user')
  const view = await container.homeQuery.execute(viewer?.id ?? null)
  return renderPage(c, <HomePage view={view} viewer={viewer} />)
}
