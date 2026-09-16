import type { Context } from 'hono'
import { visitorId } from '@/presentation/analytics/visitor'
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
  const social = await container.novelSocialQuery.execute(view.novel.id, viewer?.id ?? null)
  const tags = await container.tagRepository.listNovelTags(view.novel.id)
  const attribution = await container.forkRepository.attributionFor(view.novel.id)

  // Fire-and-forget analytics (PRD §55). Only for publicly readable novels.
  if (view.novel.visibility === 'public') {
    void container.recordAnalyticsEventService
      .execute({
        eventType: 'novel_view',
        novelId: view.novel.id,
        actorId: viewer?.id ?? null,
        sessionId: visitorId(c),
        utm: {
          source: c.req.query('utm_source') ?? null,
          medium: c.req.query('utm_medium') ?? null,
          campaign: c.req.query('utm_campaign') ?? null,
        },
      })
      .catch(() => {})
  }

  return renderPage(
    c,
    <NovelPage
      view={view}
      viewer={viewer}
      resumeEpisodeNo={resumeEpisodeNo}
      libraryState={libraryState}
      social={social}
      tags={tags}
      attribution={attribution}
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

  // Fire-and-forget episode view event (PRD §55).
  if (view.episode.status === 'published') {
    void container.recordAnalyticsEventService
      .execute({
        eventType: 'episode_view',
        novelId: view.novel.id,
        episodeId: view.episode.id,
        actorId: viewer?.id ?? null,
        sessionId: visitorId(c),
      })
      .catch(() => {})
  }

  const social = await container.episodeSocialQuery.execute(view.episode.id, viewer?.id ?? null)
  return renderPage(c, <EpisodePage view={view} viewer={viewer} social={social} />)
}
