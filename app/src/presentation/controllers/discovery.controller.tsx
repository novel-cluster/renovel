import type { Context } from 'hono'
import type { NovelCard, RankingWindow, SortKey } from '@/domain/discovery/discovery'
import type { Genre, PublicationStatus } from '@/domain/novel/entities/novel'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { RankingPage } from '@/presentation/views/discovery/ranking-page'
import { SearchPage } from '@/presentation/views/discovery/search-page'
import { renderPage } from '@/presentation/views/render'

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
const STATUSES: PublicationStatus[] = ['ongoing', 'completed', 'hiatus']
const SORTS: SortKey[] = ['new', 'likes', 'stars']

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/** `GET /search` — public search with filters/sort. */
export async function getSearch(c: Context<AppEnv>) {
  const q = c.req.query('q') ?? ''
  const genre = c.req.query('genre') ?? ''
  const status = c.req.query('status') ?? ''
  const tag = c.req.query('tag') ?? ''
  const sort = oneOf(c.req.query('sort') ?? '', SORTS) ?? 'new'
  const searched =
    q.trim() !== '' ||
    genre !== '' ||
    status !== '' ||
    tag.trim() !== '' ||
    c.req.query('sort') !== undefined

  const results = searched
    ? await container.searchNovelsQuery.execute({
        q,
        genre: oneOf(genre, GENRES),
        status: oneOf(status, STATUSES),
        tag: tag || null,
        sort,
        limit: 40,
      })
    : []

  return renderPage(
    c,
    <SearchPage
      results={results}
      state={{ q, genre, status, tag, sort }}
      searched={searched}
      viewer={c.get('user')}
    />,
  )
}

/** `GET /ranking` — daily/weekly/monthly/new/completed. */
export async function getRanking(c: Context<AppEnv>) {
  const kind = c.req.query('kind') ?? 'week'
  let novels: NovelCard[]
  if (kind === 'new') {
    novels = await container.searchNovelsQuery.execute({ sort: 'new', limit: 30 })
  } else if (kind === 'completed') {
    novels = await container.rankingQuery.execute({ window: 'all', onlyCompleted: true, limit: 30 })
  } else {
    const window: RankingWindow = kind === 'day' ? 'day' : kind === 'month' ? 'month' : 'week'
    novels = await container.rankingQuery.execute({ window, limit: 30 })
  }
  return renderPage(c, <RankingPage novels={novels} kind={kind} viewer={c.get('user')} />)
}
