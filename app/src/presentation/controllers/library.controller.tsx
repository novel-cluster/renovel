import type { Context } from 'hono'
import { isLibraryState } from '@/application/services/reading/library.service'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { LibraryPage } from '@/presentation/views/library'
import { renderPage } from '@/presentation/views/render'

/** Redirect back to the page the form was submitted from, else /library. */
function backTo(c: Context<AppEnv>): string {
  const ref = c.req.header('referer')
  if (ref) {
    try {
      return new URL(ref).pathname
    } catch {}
  }
  return '/library'
}

/** Client islands POST with `Accept: application/json`; no-JS forms want a redirect. */
function wantsJson(c: Context<AppEnv>): boolean {
  return (c.req.header('accept') ?? '').includes('application/json')
}

export async function getLibrary(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const items = await container.listLibraryService.execute(viewer.id)
  return renderPage(c, <LibraryPage items={items} viewer={viewer} />)
}

export async function postSetLibrary(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const body = await c.req.parseBody()
  const state = body.state
  if (isLibraryState(state)) {
    await container.setLibraryStateService.execute({
      userId: viewer.id,
      novelId: String(body.novelId ?? ''),
      state,
    })
    if (wantsJson(c)) return c.json({ state })
  }
  return c.redirect(backTo(c))
}

export async function postRemoveLibrary(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const body = await c.req.parseBody()
  await container.removeFromLibraryService.execute(viewer.id, String(body.novelId ?? ''))
  if (wantsJson(c)) return c.json({ ok: true })
  return c.redirect(backTo(c))
}
