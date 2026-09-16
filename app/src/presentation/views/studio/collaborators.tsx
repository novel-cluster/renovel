import type { FC } from 'hono/jsx'
import type { CollaboratorsView } from '@/application/services/collaboration/collaboration.query'
import type { CollaboratorRole } from '@/domain/collaboration/collaboration'
import type { AuthUser } from '@/presentation/env'
import { FormError } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const ROLE_LABEL: Record<CollaboratorRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  writer: '執筆者',
  editor: '校正者',
  viewer: '閲覧者',
}
const ASSIGNABLE: CollaboratorRole[] = ['admin', 'writer', 'editor', 'viewer']

/** Studio collaborators panel (PRD §13). Invite/remove for owner/admin. */
export const CollaboratorsPage: FC<{
  view: CollaboratorsView
  viewer: AuthUser
  error?: string
}> = ({ view, viewer, error }) => {
  const canManage = view.role === 'owner' || view.role === 'admin'
  const { novel } = view
  return (
    <Layout title={`共同制作者 | ${novel.title}`} noindex>
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-2xl px-6 py-10">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-semibold tracking-tight">共同制作者 — {novel.title}</h1>
          <a class="text-sm text-primary hover:underline" href={`/studio/novels/${novel.id}`}>
            スタジオへ戻る
          </a>
        </div>

        <FormError message={error} />

        <ul class="mt-6 divide-y divide-border border-y border-border">
          <li class="flex items-center justify-between py-3 text-sm">
            <span>作者</span>
            <span class="text-xs text-muted-foreground">オーナー</span>
          </li>
          {view.collaborators.map((col) => (
            <li class="flex items-center justify-between py-3 text-sm">
              <a class="hover:text-primary" href={`/@${col.handle}`}>
                {col.displayName}
              </a>
              <span class="flex items-center gap-3 text-xs text-muted-foreground">
                {ROLE_LABEL[col.role]}
                {canManage && col.role !== 'owner' ? (
                  <form method="post" action={`/studio/novels/${novel.id}/collaborators/remove`}>
                    <input type="hidden" name="userId" value={col.userId} />
                    <button
                      type="submit"
                      class="rounded border border-border px-2 py-1 hover:bg-muted"
                    >
                      外す
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {canManage ? (
          <form
            method="post"
            action={`/studio/novels/${novel.id}/collaborators`}
            class="mt-6 flex flex-wrap items-center gap-2"
          >
            <input
              name="handle"
              placeholder="招待するユーザーの handle"
              required
              class="min-w-48 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              name="role"
              class="rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              {ASSIGNABLE.map((r) => (
                <option value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
            <button
              type="submit"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              招待する
            </button>
          </form>
        ) : null}
      </main>
    </Layout>
  )
}
