import type { FC } from 'hono/jsx'
import type { Novel } from '@/domain/novel/entities/novel'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const VISIBILITY_LABEL = { public: '公開', unlisted: '限定公開', private: '非公開' } as const

/** Author studio: list of the current user's novels. */
export const StudioIndexPage: FC<{ novels: Novel[]; viewer: AuthUser }> = ({ novels, viewer }) => (
  <Layout title="スタジオ | ReNovel">
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
