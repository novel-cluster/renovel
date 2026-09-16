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
  const viewerId = c.get('user')?.id ?? null
  const view = await container.readNovelQuery.novelBySlug(c.req.param('slug') ?? '', viewerId)
  // The slug is canonical; guard against a mismatched handle in the URL.
  if (view.author.handle !== handleOf(c)) throw new NotFoundError('作品が見つかりません')
  return renderPage(c, <NovelPage view={view} viewer={c.get('user')} />)
}

/** `GET /@{handle}/{slug}/episodes/{episodeNo}` — public episode reading. */
export async function getEpisodePage(c: Context<AppEnv>) {
  const viewerId = c.get('user')?.id ?? null
  const episodeNo = Number(c.req.param('episodeNo'))
  const view = await container.readNovelQuery.episodeByNo(
    c.req.param('slug') ?? '',
    episodeNo,
    viewerId,
  )
  if (view.author.handle !== handleOf(c)) throw new NotFoundError('作品が見つかりません')
  return renderPage(c, <EpisodePage view={view} viewer={c.get('user')} />)
}
