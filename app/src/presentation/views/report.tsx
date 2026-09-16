import type { FC } from 'hono/jsx'
import type { ReportTargetType } from '@/domain/moderation/moderation'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const LABEL: Record<ReportTargetType, string> = {
  user: 'ユーザー',
  novel: '作品',
  episode: 'エピソード',
  comment: 'コメント',
  review: 'レビュー',
}

/** Report form (PRD §37). */
export const ReportPage: FC<{
  targetType: ReportTargetType
  targetId: string
  viewer: AuthUser | null
}> = ({ targetType, targetId, viewer }) => (
  <Layout title="通報 | ReNovel" noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-md px-6 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">通報</h1>
      <p class="mt-2 text-sm text-muted-foreground">{LABEL[targetType]}を運営に通報します。</p>
      <form method="post" action="/report" class="mt-6 space-y-3">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <textarea
          name="reason"
          rows={4}
          required
          placeholder="通報の理由"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          通報する
        </button>
      </form>
    </main>
  </Layout>
)
