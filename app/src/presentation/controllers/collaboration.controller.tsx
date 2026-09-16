import type { Context } from 'hono'
import type { CollaboratorRole } from '@/domain/collaboration/collaboration'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { renderPage } from '@/presentation/views/render'
import { CollaboratorsPage } from '@/presentation/views/studio/collaborators'
import { AppError } from '@/shared/errors/app-error'

const ROLES: CollaboratorRole[] = ['admin', 'writer', 'editor', 'viewer']
const oneRole = (v: unknown): CollaboratorRole =>
  typeof v === 'string' && (ROLES as string[]).includes(v) ? (v as CollaboratorRole) : 'viewer'

function backTo(c: Context<AppEnv>): string {
  const ref = c.req.header('referer')
  if (ref) {
    try {
      return new URL(ref).pathname
    } catch {}
  }
  return '/'
}

export async function getCollaborators(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const view = await container.collaborationQuery.collaboratorsView(
    viewer.id,
    c.req.param('novelId') ?? '',
  )
  return renderPage(
    c,
    <CollaboratorsPage view={view} viewer={viewer} error={c.req.query('error') ?? undefined} />,
  )
}

export async function postInviteCollaborator(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const novelId = c.req.param('novelId') ?? ''
  const body = await c.req.parseBody()
  try {
    await container.inviteCollaboratorService.execute({
      actorUserId: viewer.id,
      novelId,
      handle: String(body.handle ?? ''),
      role: oneRole(body.role),
    })
    return c.redirect(`/studio/novels/${novelId}/collaborators`)
  } catch (err) {
    if (err instanceof AppError) {
      return c.redirect(
        `/studio/novels/${novelId}/collaborators?error=${encodeURIComponent(err.message)}`,
      )
    }
    throw err
  }
}

export async function postRemoveCollaborator(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const novelId = c.req.param('novelId') ?? ''
  const body = await c.req.parseBody()
  await container.removeCollaboratorService.execute({
    actorUserId: viewer.id,
    novelId,
    userId: String(body.userId ?? ''),
  })
  return c.redirect(`/studio/novels/${novelId}/collaborators`)
}

export async function postRespondInvitation(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const body = await c.req.parseBody()
  await container.respondInvitationService.execute({
    actorUserId: viewer.id,
    invitationId: c.req.param('invitationId') ?? '',
    accept: body.accept === 'true',
  })
  return c.redirect(backTo(c))
}

/** `POST /@{handle}/{slug}/fork` — create a derivative work (PRD §14). */
export async function postFork(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const forked = await container.forkNovelService.execute({
    actorUserId: viewer.id,
    sourceSlug: c.req.param('slug') ?? '',
  })
  return c.redirect(`/studio/novels/${forked.id}`)
}
