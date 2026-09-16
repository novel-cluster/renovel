import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { renderPage } from '@/presentation/views/render'
import { EditorPage } from '@/presentation/views/studio/editor'
import { AppError } from '@/shared/errors/app-error'

export async function getEditor(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const view = await container.getEpisodeEditorService.execute(
    viewer.id,
    c.req.param('episodeId') ?? '',
  )
  return renderPage(
    c,
    <EditorPage view={view} viewer={viewer} saved={c.req.query('saved') === '1'} />,
  )
}

export async function postSaveEpisode(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const { novelId, episodeId } = c.req.param()
  const body = await c.req.parseBody()
  try {
    await container.saveEpisodeService.execute({
      actorUserId: viewer.id,
      episodeId,
      title: typeof body.title === 'string' ? body.title : undefined,
      body: typeof body.body === 'string' ? body.body : undefined,
      createRevision: true, // manual save records a revision (writing-revision.md §2.2)
    })
    return c.redirect(`/studio/novels/${novelId}/episodes/${episodeId}?saved=1`)
  } catch (err) {
    if (err instanceof AppError) {
      const view = await container.getEpisodeEditorService.execute(viewer.id, episodeId)
      return renderPage(
        c,
        <EditorPage view={view} viewer={viewer} error={err.message} />,
        err.status,
      )
    }
    throw err
  }
}

export async function postPublishEpisode(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const { novelId, episodeId } = c.req.param()
  const episode = await container.publishEpisodeService.execute({
    actorUserId: viewer.id,
    episodeId,
  })
  // Fan out a novel_update notification to followers (PRD §22), non-blocking.
  void container.notifyNovelUpdateService
    .execute({ novelId: episode.novelId, episodeId: episode.id, episodeNo: episode.episodeNo })
    .catch(() => {})
  return c.redirect(`/studio/novels/${novelId}/episodes/${episodeId}?saved=1`)
}
