import type { FC } from 'hono/jsx'
import type { HomeView } from '@/application/queries/discovery/discovery.query'
import type { NovelCard } from '@/domain/discovery/discovery'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from './components/site-header'
import { NovelCardGrid } from './discovery/novel-card'
import { Layout } from './layout'

const STATUS_LABEL = { ongoing: '連載中', completed: '完結', hiatus: '休載中' } as const

/** Genre nav bar — syosetu-style horizontal category strip. */
const GENRE_NAV: [string, string][] = [
  ['fantasy', 'ファンタジー'],
  ['sf', 'SF'],
  ['romance', '恋愛'],
  ['mystery', 'ミステリー'],
  ['horror', 'ホラー'],
  ['literary', '文芸'],
  ['essay', 'エッセイ'],
  ['other', 'その他'],
]
const GENRE_LABEL = Object.fromEntries(GENRE_NAV) as Record<string, string>

const GenreNav: FC = () => (
  <nav class="border-b border-border bg-muted/40">
    <ul class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-6 py-2 text-sm">
      <li>
        <a class="rounded px-2 py-1 font-medium text-foreground hover:bg-muted" href="/search">
          総合
        </a>
      </li>
      {GENRE_NAV.map(([key, label]) => (
        <li>
          <a
            class="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            href={`/search?genre=${key}`}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
)

/** Numbered ranking list — the signature syosetu-style ranked table. */
const RankingList: FC<{ novels: NovelCard[] }> = ({ novels }) => {
  if (!novels.length) {
    return <p class="text-sm text-muted-foreground">まだランキングデータがありません。</p>
  }
  return (
    <ol class="divide-y divide-border rounded-lg border border-border">
      {novels.map((n, i) => {
        const rank = i + 1
        const badge =
          rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        return (
          <li class="flex items-start gap-3 p-3">
            <span
              class={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${badge}`}
            >
              {rank}
            </span>
            <div class="min-w-0 flex-1">
              <a
                href={`/@${n.authorHandle}/${n.slug}`}
                class="font-medium tracking-tight hover:text-primary"
              >
                {n.title}
              </a>
              {n.catchphrase ? (
                <p class="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{n.catchphrase}</p>
              ) : null}
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {n.genre ? (
                  <span class="rounded bg-muted px-1.5 py-0.5">
                    {GENRE_LABEL[n.genre] ?? n.genre}
                  </span>
                ) : null}
                <span class="rounded bg-muted px-1.5 py-0.5">
                  {STATUS_LABEL[n.publicationStatus]}
                </span>
                <a class="hover:text-primary" href={`/@${n.authorHandle}`}>
                  {n.authorName}
                </a>
                <span>♥ {n.likeCount}</span>
                {n.starCount > 0 ? <span>★ {n.starAvg.toFixed(2)}</span> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Reader home (PRD §28), syosetu-style: genre nav + ranked lists + sidebar. */
export const HomePage: FC<{ view: HomeView; viewer: AuthUser | null }> = ({ view, viewer }) => (
  <Layout
    title="ReNovel — Web小説を読む・書く"
    description="読者を第一にした Web 小説投稿プラットフォーム。"
    canonical="/"
  >
    <SiteHeader user={viewer} wide />
    <GenreNav />
    <main class="mx-auto max-w-6xl px-6 py-8">
      {viewer ? null : (
        <section class="mb-8 rounded-lg border border-border bg-muted/40 p-6">
          <h1 class="text-2xl font-semibold tracking-tight">ReNovel</h1>
          <p class="mt-2 text-muted-foreground">
            書き、公開し、読まれ方を知り、他者と作品を作れる場所。
          </p>
          <div class="mt-4 flex gap-3">
            <a
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              href="/signup"
            >
              はじめる
            </a>
            <a
              class="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              href="/search"
            >
              作品を探す
            </a>
          </div>
        </section>
      )}

      <div class="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div class="space-y-10 lg:col-span-2">
          <section>
            <div class="mb-3 flex items-center justify-between border-b-2 border-primary pb-2">
              <h2 class="text-lg font-bold">週間ランキング</h2>
              <a class="text-sm text-primary hover:underline" href="/ranking">
                もっと見る
              </a>
            </div>
            <RankingList novels={view.ranking} />
          </section>

          {viewer && view.recommended.length ? (
            <section>
              <div class="mb-3 flex items-center justify-between border-b-2 border-primary pb-2">
                <h2 class="text-lg font-bold">あなたへのおすすめ</h2>
              </div>
              <NovelCardGrid novels={view.recommended} />
            </section>
          ) : null}

          <section>
            <div class="mb-3 flex items-center justify-between border-b-2 border-primary pb-2">
              <h2 class="text-lg font-bold">新着作品</h2>
              <a class="text-sm text-primary hover:underline" href="/search?sort=new">
                もっと見る
              </a>
            </div>
            <NovelCardGrid novels={view.newest} empty="まだ公開作品がありません。" />
          </section>
        </div>

        {/* Sidebar */}
        <aside class="space-y-6">
          <section class="rounded-lg border border-border p-4">
            <h2 class="mb-3 text-sm font-bold text-foreground">ジャンルから探す</h2>
            <ul class="space-y-1 text-sm">
              {GENRE_NAV.map(([key, label]) => (
                <li>
                  <a
                    class="flex items-center justify-between rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    href={`/search?genre=${key}`}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true">›</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section class="rounded-lg border border-border p-4">
            <h2 class="mb-2 text-sm font-bold text-foreground">メニュー</h2>
            <ul class="space-y-1 text-sm">
              <li>
                <a
                  class="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  href="/ranking"
                >
                  ランキング
                </a>
              </li>
              <li>
                <a
                  class="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  href="/search"
                >
                  作品検索
                </a>
              </li>
              {viewer ? (
                <>
                  <li>
                    <a
                      class="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      href="/library"
                    >
                      本棚
                    </a>
                  </li>
                  <li>
                    <a
                      class="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      href="/studio"
                    >
                      スタジオ（執筆）
                    </a>
                  </li>
                </>
              ) : null}
            </ul>
          </section>

          {viewer ? (
            <section class="rounded-lg border border-border bg-muted/40 p-4">
              <h2 class="text-sm font-bold text-foreground">あなたも書いてみませんか</h2>
              <p class="mt-1 text-xs text-muted-foreground">
                プレーンテキストで、ルビ・傍点も使えます。
              </p>
              <a
                class="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                href="/studio/novels/new"
              >
                作品を作る
              </a>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  </Layout>
)
