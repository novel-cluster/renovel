import type { FC } from 'hono/jsx'
import type { PendingInvitation } from '@/domain/collaboration/collaboration'
import type { Novel } from '@/domain/novel/entities/novel'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const VISIBILITY_LABEL = { public: '公開', unlisted: '限定公開', private: '非公開' } as const
const ROLE_LABEL = {
  owner: 'オーナー',
  admin: '管理者',
  writer: '執筆者',
  editor: '校正者',
  viewer: '閲覧者',
}

/** Author studio: novels owned/collaborated + pending invitations. */
export const StudioIndexPage: FC<{
  novels: Novel[]
  invitations: PendingInvitation[]
  viewer: AuthUser
}> = ({ novels, invitations, viewer }) => (
  <Layout title="スタジオ | ReNovel" noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-2xl px-6 py-12">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold tracking-tight">スタジオ</h1>
        <a
          href="/studio/novels/new"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新規作品
        </a>
      </div>

      {invitations.length ? (
        <section class="mt-6 rounded-lg border border-border p-4">
          <h2 class="text-sm font-medium">共同制作への招待</h2>
          <ul class="mt-2 space-y-2">
            {invitations.map((inv) => (
              <li class="flex items-center justify-between gap-3 text-sm">
                <span>
                  「{inv.novelTitle}」に {ROLE_LABEL[inv.role]} として招待されています
                </span>
                <span class="flex gap-2">
                  <form method="post" action={`/invitations/${inv.id}/respond`}>
                    <input type="hidden" name="accept" value="true" />
                    <button
                      type="submit"
                      class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                    >
                      参加
                    </button>
                  </form>
                  <form method="post" action={`/invitations/${inv.id}/respond`}>
                    <input type="hidden" name="accept" value="false" />
                    <button type="submit" class="rounded-md border border-border px-2 py-1 text-xs">
                      辞退
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {novels.length ? (
        <ul class="mt-8 divide-y divide-border border-y border-border">
          {novels.map((novel) => (
            <li>
              <a
                class="flex items-center justify-between gap-3 py-3 hover:text-primary"
                href={`/studio/novels/${novel.id}`}
              >
                <span class="font-medium">{novel.title}</span>
                <span class="shrink-0 text-xs text-muted-foreground">
                  {VISIBILITY_LABEL[novel.visibility]}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p class="mt-8 text-sm text-muted-foreground">
          まだ作品がありません。「新規作品」から書き始めましょう。
        </p>
      )}
    </main>
  </Layout>
)
