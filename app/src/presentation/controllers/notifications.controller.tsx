import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { NotificationsPage } from '@/presentation/views/notifications'
import { renderPage } from '@/presentation/views/render'

/** `GET /notifications` — list + mark read (requireAuth). */
export async function getNotifications(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const items = await container.listNotificationsService.execute(viewer.id)
  return renderPage(c, <NotificationsPage items={items} viewer={viewer} />)
}
