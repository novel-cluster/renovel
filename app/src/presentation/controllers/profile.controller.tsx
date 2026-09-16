import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { ProfilePage } from '@/presentation/views/profile'
import { renderPage } from '@/presentation/views/render'

/** `GET /@{handle}` — public profile (routing.md §3.1). */
export async function getProfile(c: Context<AppEnv>) {
  // Route param captures the whole `@handle` segment; drop the leading `@`.
  const handle = (c.req.param('handle') ?? '').replace(/^@/, '')
  const profile = await container.getUserProfileService.execute(handle)
  return renderPage(c, <ProfilePage profile={profile} viewer={c.get('user')} />)
}
