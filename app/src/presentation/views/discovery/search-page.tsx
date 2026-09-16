import type { FC } from 'hono/jsx'
import type { NovelCard, SortKey } from '@/domain/discovery/discovery'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'
import { NovelCardGrid } from './novel-card'

const GENRES: [string, string][] = [
  ['', 'ジャンル：すべて'],
  ['fantasy', 'ファンタジー'],
  ['sf', 'SF'],
  ['romance', '恋愛'],
  ['mystery', 'ミステリー'],
  ['horror', 'ホラー'],
  ['literary', '文芸'],
  ['essay', 'エッセイ'],
  ['other', 'その他'],
]
const STATUSES: [string, string][] = [
  ['', '状態：すべて'],
  ['ongoing', '連載中'],
  ['completed', '完結'],
  ['hiatus', '休載中'],
]
const SORTS: [SortKey, string][] = [
  ['new', '新着順'],
  ['likes', 'いいね順'],
  ['stars', '評価順'],
]

export interface SearchState {
  q: string
  genre: string
  status: string
  tag: string
  sort: SortKey
}

const select = (name: string, value: string, options: [string, string][]) => (
  <select name={name} class="rounded-md border border-input bg-background px-2 py-2 text-sm">
    {options.map(([v, l]) => (
      <option value={v} selected={v === value}>
        {l}
      </option>
    ))}
  </select>
)

/** Search page with filters + sort (PRD §23–25). Public results only. */
export const SearchPage: FC<{
  results: NovelCard[]
  state: SearchState
  searched: boolean
  viewer: AuthUser | null
}> = ({ results, state, searched, viewer }) => (
  <Layout title="検索 | ReNovel" noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-3xl px-6 py-10">
      <h1 class="text-2xl font-semibold tracking-tight">作品を探す</h1>
      <form method="get" action="/search" class="mt-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          value={state.q}
          placeholder="タイトル・作者・タグ"
          class="min-w-48 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {state.tag ? <input type="hidden" name="tag" value={state.tag} /> : null}
        {select('genre', state.genre, GENRES)}
        {select('status', state.status, STATUSES)}
        {select('sort', state.sort, SORTS)}
        <button
          type="submit"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          検索
        </button>
      </form>

      {state.tag ? <p class="mt-3 text-sm text-muted-foreground">タグ: #{state.tag}</p> : null}

      <div class="mt-8">
        {searched ? (
          <NovelCardGrid novels={results} empty="該当する作品が見つかりませんでした。" />
        ) : (
          <p class="text-sm text-muted-foreground">キーワードや条件を指定して検索してください。</p>
        )}
      </div>
    </main>
  </Layout>
)
