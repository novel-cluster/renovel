import type { Context } from 'hono'
import { isReportTarget } from '@/application/services/moderation/moderation.service'
import type { ReportStatus, UserStatus } from '@/domain/moderation/moderation'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { AdminPage } from '@/presentation/views/admin'
import { renderPage } from '@/presentation/views/render'
import { ReportPage } from '@/presentation/views/report'

function backTo(c: Context<AppEnv>): string {
  const ref = c.req.header('referer')
  if (ref) {
    try {
      return new URL(ref).pathname
    } catch {}
  }
  return '/'
}

function admin(c: Context<AppEnv>) {
  const u = c.get('user')
  return u ? { id: u.id, isAdmin: u.isAdmin } : null
}

export function getReportForm(c: Context<AppEnv>) {
  if (!c.get('user')) return c.redirect('/login')
  const type = c.req.query('type') ?? ''
  const id = c.req.query('id') ?? ''
  if (!isReportTarget(type) || !id) return c.redirect('/')
  return renderPage(c, <ReportPage targetType={type} targetId={id} viewer={c.get('user')} />)
}

export async function postReport(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const body = await c.req.parseBody()
  const type = String(body.targetType ?? '')
  if (isReportTarget(type)) {
    await container.reportContentService.execute({
      reporterId: viewer.id,
      targetType: type,
      targetId: String(body.targetId ?? ''),
      reason: String(body.reason ?? ''),
    })
  }
  return c.redirect(`${backTo(c)}?reported=1`)
}

export async function postBlock(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  await container.blockMuteService.toggleBlock(viewer.id, c.req.param('userId') ?? '')
  return c.redirect(backTo(c))
}

export async function postMute(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  await container.blockMuteService.toggleMute(viewer.id, c.req.param('userId') ?? '')
  return c.redirect(backTo(c))
}

// --- Admin ---

export async function getAdmin(c: Context<AppEnv>) {
  const actor = admin(c)
  if (!actor) return c.redirect('/login')
  const status = (c.req.query('status') as ReportStatus | 'all') ?? 'open'
  const reports = await container.adminModerationService.listReports(actor, status)
  return renderPage(c, <AdminPage reports={reports} status={status} viewer={c.get('user')!} />)
}

export async function postResolveReport(c: Context<AppEnv>) {
  const actor = admin(c)
  if (!actor) return c.redirect('/login')
  const body = await c.req.parseBody()
  const status = body.status === 'dismissed' ? 'dismissed' : 'resolved'
  await container.adminModerationService.resolveReport(actor, c.req.param('id') ?? '', status)
  return c.redirect(backTo(c))
}

export async function postAdminAction(c: Context<AppEnv>) {
  const actor = admin(c)
  if (!actor) return c.redirect('/login')
  const body = await c.req.parseBody()
  const action = String(body.action ?? '')
  const targetId = String(body.targetId ?? '')
  const svc = container.adminModerationService
  switch (action) {
    case 'hide_novel':
      await svc.hideNovel(actor, targetId)
      break
    case 'hide_episode':
      await svc.hideEpisode(actor, targetId)
      break
    case 'delete_comment':
      await svc.deleteComment(actor, targetId)
      break
    case 'delete_review':
      await svc.deleteReview(actor, targetId)
      break
    case 'suspend':
    case 'ban':
    case 'reactivate':
      await svc.setUserStatus(actor, targetId, ACTION_STATUS[action])
      break
  }
  return c.redirect(backTo(c))
}

const ACTION_STATUS: Record<'suspend' | 'ban' | 'reactivate', UserStatus> = {
  suspend: 'suspended',
  ban: 'banned',
  reactivate: 'active',
}
