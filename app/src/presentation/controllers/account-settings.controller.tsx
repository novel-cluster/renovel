import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { renderPage } from '@/presentation/views/render'
import { AccountSettingsPage } from '@/presentation/views/settings/account'
import { AppError } from '@/shared/errors/app-error'

/** `GET /settings/account` (requireAuth). */
export async function getAccountSettings(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const profile = await container.userRepository.findById(viewer.id)
  if (!profile) return c.redirect('/login')
  return renderPage(
    c,
    <AccountSettingsPage profile={profile} viewer={viewer} saved={c.req.query('saved') === '1'} />,
  )
}

/** `POST /settings/account` — update profile (requireAuth). */
export async function postAccountSettings(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const body = await c.req.parseBody()
  try {
    await container.updateProfileService.execute({
      userId: viewer.id,
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
    })
    return c.redirect('/settings/account?saved=1')
  } catch (err) {
    if (err instanceof AppError) {
      const profile = await container.userRepository.findById(viewer.id)
      if (!profile) throw err
      return renderPage(
        c,
        <AccountSettingsPage profile={profile} viewer={viewer} error={err.message} />,
        err.status,
      )
    }
    throw err
  }
}
