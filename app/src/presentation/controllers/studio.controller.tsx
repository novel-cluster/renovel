import type { Context } from 'hono'
import type { Genre, PublicationStatus, Visibility } from '@/domain/novel/entities/novel'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { renderPage } from '@/presentation/views/render'
import { StudioIndexPage } from '@/presentation/views/studio/index'
import { NewNovelPage } from '@/presentation/views/studio/new-novel'
import { NovelDashboardPage } from '@/presentation/views/studio/novel-dashboard'
import { AppError } from '@/shared/errors/app-error'

const GENRES: Genre[] = [
  'fantasy',
  'sf',
  'romance',
  'mystery',
  'horror',
  'literary',
  'essay',
  'other',
]
const VISIBILITIES: Visibility[] = ['public', 'unlisted', 'private']
const STATUSES: PublicationStatus[] = ['ongoing', 'completed', 'hiatus']

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

export async function getStudio(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const novels = await container.listStudioNovelsService.execute(viewer.id)
  return renderPage(c, <StudioIndexPage novels={novels} viewer={viewer} />)
}

export function getNewNovel(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  return renderPage(c, <NewNovelPage viewer={viewer} />)
}

export async function postCreateNovel(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const body = await c.req.parseBody()
  try {
    const novel = await container.createNovelService.execute({
      authorId: viewer.id,
      title: String(body.title ?? ''),
    })
    return c.redirect(`/studio/novels/${novel.id}`)
  } catch (err) {
    if (err instanceof AppError) {
      return renderPage(c, <NewNovelPage viewer={viewer} error={err.message} />, err.status)
    }
    throw err
  }
}

export async function getNovelDashboard(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const view = await container.getNovelStudioService.execute(
    viewer.id,
    c.req.param('novelId') ?? '',
  )
  const tags = await container.tagRepository.listNovelTags(view.novel.id)
  return renderPage(
    c,
    <NovelDashboardPage
      view={view}
      viewer={viewer}
      tags={tags}
      saved={c.req.query('saved') === '1'}
    />,
  )
}

export async function postUpdateNovel(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const novelId = c.req.param('novelId') ?? ''
  const body = await c.req.parseBody()
  try {
    await container.updateNovelService.execute({
      actorUserId: viewer.id,
      novelId,
      title: typeof body.title === 'string' ? body.title : undefined,
      catchphrase: typeof body.catchphrase === 'string' ? body.catchphrase : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      genre: body.genre === '' ? null : oneOf(body.genre, GENRES),
      visibility: oneOf(body.visibility, VISIBILITIES),
      publicationStatus: oneOf(body.publicationStatus, STATUSES),
      contentWarnings: parseWarnings(body.contentWarnings),
    })
    await container.setNovelTagsService.execute({
      actorUserId: viewer.id,
      novelId,
      names: parseWarnings(body.tags) ?? [],
    })
    return c.redirect(`/studio/novels/${novelId}?saved=1`)
  } catch (err) {
    if (err instanceof AppError) {
      const view = await container.getNovelStudioService.execute(viewer.id, novelId)
      const tags = await container.tagRepository.listNovelTags(novelId)
      return renderPage(
        c,
        <NovelDashboardPage view={view} viewer={viewer} tags={tags} error={err.message} />,
        err.status,
      )
    }
    throw err
  }
}

export async function postCreateEpisode(c: Context<AppEnv>) {
  const viewer = c.get('user')
  if (!viewer) return c.redirect('/login')
  const novelId = c.req.param('novelId') ?? ''
  const episode = await container.createEpisodeService.execute({ actorUserId: viewer.id, novelId })
  return c.redirect(`/studio/novels/${novelId}/episodes/${episode.id}`)
}

function parseWarnings(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined
  return value
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}
