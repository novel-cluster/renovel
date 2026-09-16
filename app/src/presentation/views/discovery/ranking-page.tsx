import type { FC } from 'hono/jsx'
import type { NovelCard } from '@/domain/discovery/discovery'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'
import { NovelCardGrid } from './novel-card'

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
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-3xl px-6 py-10">
      <h1 class="text-2xl font-semibold tracking-tight">ランキング</h1>
      <nav class="mt-4 flex flex-wrap gap-2 text-sm">
        {TABS.map(([k, label]) => (
          <a
            href={`/ranking?kind=${k}`}
            aria-current={k === kind}
            class="rounded-md border border-border px-3 py-1.5 hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:text-primary"
          >
            {label}
          </a>
        ))}
      </nav>
      <div class="mt-8">
        <NovelCardGrid novels={novels} empty="ランキングデータがまだありません。" />
      </div>
    </main>
  </Layout>
)
