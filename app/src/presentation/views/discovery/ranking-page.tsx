import type { FC } from 'hono/jsx'
import type { NovelCard } from '@/domain/discovery/discovery'
import type { AuthUser } from '@/presentation/env'
import { GenreNav } from '@/presentation/views/components/genre-nav'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'
import { RankingList } from './ranking-list'

const TABS: [string, string][] = [
  ['day', '日間'],
  ['week', '週間'],
  ['month', '月間'],
  ['new', '新着'],
  ['completed', '完結'],
]

/** Ranking page (PRD §26). Public novels only, time-decayed score. */
export const RankingPage: FC<{
  novels: NovelCard[]
  kind: string
  viewer: AuthUser | null
}> = ({ novels, kind, viewer }) => (
  <Layout
    title="ランキング | ReNovel"
    description="人気の Web 小説ランキング。"
    canonical="/ranking"
  >
    <SiteHeader user={viewer} wide />
    <GenreNav />
    <main class="mx-auto max-w-6xl px-6 py-8">
      <div class="grid gap-8 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <h1 class="text-2xl font-bold tracking-tight">ランキング</h1>
          <nav class="flex flex-wrap gap-2 text-sm">
            {TABS.map(([k, label]) => (
              <a
                href={`/ranking?kind=${k}`}
                aria-current={k === kind}
                class="rounded-md border border-border px-3 py-1.5 hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <RankingList novels={novels} empty="ランキングデータがまだありません。" />
        </div>

        <aside class="space-y-6">
          <section class="rounded-lg border border-border p-4">
            <h2 class="mb-3 text-sm font-bold text-foreground">集計期間</h2>
            <ul class="space-y-1 text-sm">
              {TABS.map(([k, label]) => (
                <li>
                  <a
                    class={`block rounded px-2 py-1.5 hover:bg-muted hover:text-foreground ${
                      k === kind ? 'font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                    href={`/ranking?kind=${k}`}
                  >
                    {label}ランキング
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
                  href="/search"
                >
                  作品検索
                </a>
              </li>
              <li>
                <a
                  class="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  href="/"
                >
                  ホーム
                </a>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  </Layout>
)
