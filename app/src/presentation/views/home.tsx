import type { FC } from 'hono/jsx'
import type { HomeView } from '@/application/queries/discovery/discovery.query'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from './components/site-header'
import { NovelCardGrid } from './discovery/novel-card'
import { Layout } from './layout'

/** Reader home (PRD §28). Cacheable ranking/new blocks + personalized recommendations. */
export const HomePage: FC<{ view: HomeView; viewer: AuthUser | null }> = ({ view, viewer }) => (
  <Layout
    title="ReNovel — Web小説を読む・書く"
    description="読者を第一にした Web 小説投稿プラットフォーム。"
    canonical="/"
  >
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-3xl space-y-12 px-6 py-10">
      {viewer ? null : (
        <section class="rounded-lg border border-border p-6">
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

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-medium">週間ランキング</h2>
          <a class="text-sm text-primary hover:underline" href="/ranking">
            ランキングをもっと見る
          </a>
        </div>
        <NovelCardGrid novels={view.ranking} empty="まだランキングデータがありません。" />
      </section>

      {viewer && view.recommended.length ? (
        <section>
          <h2 class="mb-3 text-lg font-medium">あなたへのおすすめ</h2>
          <NovelCardGrid novels={view.recommended} />
        </section>
      ) : null}

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-medium">新着作品</h2>
          <a class="text-sm text-primary hover:underline" href="/search?sort=new">
            もっと見る
          </a>
        </div>
        <NovelCardGrid novels={view.newest} empty="まだ公開作品がありません。" />
      </section>
    </main>
  </Layout>
)
