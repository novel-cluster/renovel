import type { FC } from 'hono/jsx'
import type { ReportTargetType, ReportView } from '@/domain/moderation/moderation'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const TARGET_LABEL: Record<ReportTargetType, string> = {
  user: 'ユーザー',
  novel: '作品',
  episode: 'エピソード',
  comment: 'コメント',
  review: 'レビュー',
}
const TABS = ['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const

/** Button that posts an admin action against the report's target. */
const ActionButton: FC<{ action: string; targetId: string; label: string }> = ({
  action,
  targetId,
  label,
}) => (
  <form method="post" action="/admin/actions" class="inline">
    <input type="hidden" name="action" value={action} />
    <input type="hidden" name="targetId" value={targetId} />
    <button type="submit" class="rounded border border-border px-2 py-1 text-xs hover:bg-muted">
      {label}
    </button>
  </form>
)

const TargetActions: FC<{ report: ReportView }> = ({ report }) => {
  switch (report.targetType) {
    case 'novel':
      return <ActionButton action="hide_novel" targetId={report.targetId} label="作品を非表示" />
    case 'episode':
      return <ActionButton action="hide_episode" targetId={report.targetId} label="話を非表示" />
    case 'comment':
      return (
        <ActionButton action="delete_comment" targetId={report.targetId} label="コメント削除" />
      )
    case 'review':
      return <ActionButton action="delete_review" targetId={report.targetId} label="レビュー削除" />
    case 'user':
      return (
        <span class="flex gap-1">
          <ActionButton action="suspend" targetId={report.targetId} label="凍結" />
          <ActionButton action="ban" targetId={report.targetId} label="BAN" />
          <ActionButton action="reactivate" targetId={report.targetId} label="解除" />
        </span>
      )
  }
}

/** Admin moderation queue (PRD §37). */
export const AdminPage: FC<{ reports: ReportView[]; status: string; viewer: AuthUser }> = ({
  reports,
  status,
  viewer,
}) => (
  <Layout title="管理 | ReNovel" noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-3xl px-6 py-10">
      <h1 class="text-2xl font-semibold tracking-tight">通報キュー</h1>
      <nav class="mt-4 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <a
            href={`/admin?status=${t}`}
            aria-current={t === status}
            class="rounded-md border border-border px-3 py-1 hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:text-primary"
          >
            {t}
          </a>
        ))}
      </nav>

      {reports.length ? (
        <ul class="mt-6 space-y-4">
          {reports.map((r) => (
            <li class="rounded-lg border border-border p-4 text-sm">
              <div class="flex items-center justify-between">
                <span class="font-medium">
                  {TARGET_LABEL[r.targetType]}{' '}
                  <span class="text-xs text-muted-foreground">#{r.targetId.slice(0, 8)}</span>
                </span>
                <span class="text-xs text-muted-foreground">
                  {r.status} · {r.reporterName ?? '匿名'}
                </span>
              </div>
              <p class="mt-2 whitespace-pre-wrap">{r.reason}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <TargetActions report={r} />
                <form method="post" action={`/admin/reports/${r.id}/resolve`} class="inline">
                  <input type="hidden" name="status" value="resolved" />
                  <button
                    type="submit"
                    class="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                  >
                    対応済み
                  </button>
                </form>
                <form method="post" action={`/admin/reports/${r.id}/resolve`} class="inline">
                  <input type="hidden" name="status" value="dismissed" />
                  <button
                    type="submit"
                    class="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    却下
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p class="mt-6 text-sm text-muted-foreground">対象の通報はありません。</p>
      )}
    </main>
  </Layout>
)
