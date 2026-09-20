import type { FC } from 'hono/jsx'
import type { HomeView } from '@/application/queries/discovery/discovery.query'
import type { AuthUser } from '@/presentation/env'
import { GENRE_NAV, GenreNav } from './components/genre-nav'
import { SectionHeading } from './components/section-heading'
import { SiteHeader } from './components/site-header'
import { NovelCardGrid } from './discovery/novel-card'
import { RankingList } from './discovery/ranking-list'
import { Layout } from './layout'

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
            <SectionHeading title="週間ランキング" moreHref="/ranking" />
            <RankingList novels={view.ranking} />
          </section>

          {viewer && view.recommended.length ? (
            <section>
              <SectionHeading title="あなたへのおすすめ" />
              <NovelCardGrid novels={view.recommended} />
            </section>
          ) : null}

          <section>
            <SectionHeading title="新着作品" moreHref="/search?sort=new" />
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
