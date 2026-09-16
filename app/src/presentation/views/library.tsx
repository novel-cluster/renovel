import type { FC } from 'hono/jsx'
import type { LibraryItem, LibraryState } from '@/domain/reading/entities/reading'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const STATE_LABEL: Record<LibraryState, string> = {
  reading: '読んでいる',
  read_later: '後で読む',
  completed: '読み終わった',
  favorite: 'お気に入り',
}

/** Reader's library (PRD §19). Private page → noindex. */
export const LibraryPage: FC<{ items: LibraryItem[]; viewer: AuthUser }> = ({ items, viewer }) => (
  <Layout title="本棚 | ReNovel" noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-2xl px-6 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">本棚</h1>
      {items.length ? (
        <ul class="mt-6 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li class="flex items-center justify-between gap-3 py-3">
              <a class="hover:text-primary" href={`/@${item.authorHandle}/${item.slug}`}>
                {item.title}
              </a>
              <span class="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {STATE_LABEL[item.state]}
                <form method="post" action="/library/remove">
                  <input type="hidden" name="novelId" value={item.novelId} />
                  <button
                    type="submit"
                    class="rounded border border-border px-2 py-1 hover:bg-muted"
                  >
                    外す
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="mt-6 text-sm text-muted-foreground">
          本棚は空です。作品ページから「本棚に追加」できます。
        </p>
      )}
    </main>
  </Layout>
)
