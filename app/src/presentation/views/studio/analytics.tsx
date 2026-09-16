import type { FC } from 'hono/jsx'
import type { AnalyticsDashboard } from '@/application/services/analytics/analytics.service'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const pct = (v: number) => `${Math.round(v * 100)}%`

const Stat: FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div class="rounded-lg border border-border p-4">
    <div class="text-xs text-muted-foreground">{label}</div>
    <div class="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
  </div>
)

/** Author analytics dashboard (PRD §29–32). Aggregated only (PRD §58). */
export const AnalyticsPage: FC<{
  dashboard: AnalyticsDashboard
  novelId: string
  viewer: AuthUser
}> = ({ dashboard, novelId, viewer }) => (
  <Layout title={`分析 | ${dashboard.novelTitle}`} noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-3xl px-6 py-10">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold tracking-tight">分析 — {dashboard.novelTitle}</h1>
        <a class="text-sm text-primary hover:underline" href={`/studio/novels/${novelId}`}>
          スタジオへ戻る
        </a>
      </div>

      <nav class="mt-3 flex gap-2 text-sm">
        <a
          href={`/studio/novels/${novelId}/analytics?days=7`}
          aria-current={dashboard.days === 7}
          class="rounded-md border border-border px-3 py-1 hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:text-primary"
        >
          7日
        </a>
        <a
          href={`/studio/novels/${novelId}/analytics?days=30`}
          aria-current={dashboard.days === 30}
          class="rounded-md border border-border px-3 py-1 hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:text-primary"
        >
          30日
        </a>
      </nav>

      <section class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="PV" value={dashboard.pv} />
        <Stat label="ユニーク訪問者" value={dashboard.uniqueVisitors} />
        <Stat label="いいね" value={dashboard.likeCount} />
        <Stat label="フォロワー" value={dashboard.followCount} />
        <Stat
          label="評価"
          value={
            dashboard.starCount > 0
              ? `★${dashboard.starAvg.toFixed(2)} (${dashboard.starCount})`
              : '—'
          }
        />
      </section>

      <section class="mt-10">
        <h2 class="mb-3 text-lg font-medium">読了ファネル（エピソード別）</h2>
        {dashboard.funnel.length ? (
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs text-muted-foreground">
                  <th class="py-2 pr-3">話</th>
                  <th class="py-2 pr-3">ユニーク</th>
                  <th class="py-2 pr-3">閲覧</th>
                  <th class="py-2 pr-3">読了</th>
                  <th class="py-2 pr-3">読了率</th>
                  <th class="py-2">第1話比</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.funnel.map((f) => (
                  <tr class="border-b border-border/60">
                    <td class="py-2 pr-3">
                      第{f.episodeNo}話 <span class="text-muted-foreground">{f.title}</span>
                    </td>
                    <td class="py-2 pr-3">{f.unique}</td>
                    <td class="py-2 pr-3">{f.views}</td>
                    <td class="py-2 pr-3">{f.completions}</td>
                    <td class="py-2 pr-3">{pct(f.completionRate)}</td>
                    <td class="py-2">{pct(f.retentionFromFirst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p class="text-sm text-muted-foreground">まだ公開エピソードのデータがありません。</p>
        )}
      </section>

      <p class="mt-8 text-xs text-muted-foreground">
        ※ すべて集計値です。個々の読者の行動は表示しません（プライバシー、PRD §58）。
      </p>
    </main>
  </Layout>
)
