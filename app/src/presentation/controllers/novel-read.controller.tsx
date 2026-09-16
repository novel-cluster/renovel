import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { EpisodePage } from '@/presentation/views/reading/episode-page'
import { NovelPage } from '@/presentation/views/reading/novel-page'
import { renderPage } from '@/presentation/views/render'
import { NotFoundError } from '@/shared/errors/app-error'

function handleOf(c: Context<AppEnv>): string {
  return (c.req.param('handle') ?? '').replace(/^@/, '')
}

/** `GET /@{handle}/{slug}` — public novel page. */
export async function getNovelPage(c: Context<AppEnv>) {
  const viewer = c.get('user')
  const view = await container.readNovelQuery.novelBySlug(
    c.req.param('slug') ?? '',
    viewer?.id ?? null,
  )
  // The slug is canonical; guard against a mismatched handle in the URL.
  if (view.author.handle !== handleOf(c)) throw new NotFoundError('作品が見つかりません')

  const resumeEpisodeNo = viewer
    ? await container.resumeReadingService.execute(viewer.id, view.novel.id)
    : null
  const libraryState = viewer
    ? await container.getLibraryStateService.execute(viewer.id, view.novel.id)
    : null

  return renderPage(
    c,
    <NovelPage
      view={view}
      viewer={viewer}
      resumeEpisodeNo={resumeEpisodeNo}
      libraryState={libraryState}
    />,
  )
}

/** `GET /@{handle}/{slug}/episodes/{episodeNo}` — public episode reading. */
export async function getEpisodePage(c: Context<AppEnv>) {
  const viewer = c.get('user')
  const episodeNo = Number(c.req.param('episodeNo'))
  const view = await container.readNovelQuery.episodeByNo(
    c.req.param('slug') ?? '',
    episodeNo,
    viewer?.id ?? null,
  )
  if (view.author.handle !== handleOf(c)) throw new NotFoundError('作品が見つかりません')

  // Record reading progress without blocking the response (PRD §18, §55).
  if (viewer && view.episode.status === 'published') {
    void container.recordReadingProgressService
      .execute({ userId: viewer.id, novelId: view.novel.id, episodeId: view.episode.id })
      .catch(() => {})
  }

  return renderPage(c, <EpisodePage view={view} viewer={viewer} />)
}
