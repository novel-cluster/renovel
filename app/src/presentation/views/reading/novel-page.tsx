import type { FC } from 'hono/jsx'
import type { NovelReadView } from '@/application/services/reading/read-novel.query'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const STATUS_LABEL = { ongoing: '連載中', completed: '完結', hiatus: '休載中' } as const
const VISIBILITY_LABEL = { public: '公開', unlisted: '限定公開', private: '非公開' } as const

/** Public novel page with table of contents (routing.md §3.1). */
export const NovelPage: FC<{ view: NovelReadView; viewer: AuthUser | null }> = ({
  view,
  viewer,
}) => {
  const { novel, author, episodes, isOwner } = view
  return (
    <Layout title={`${novel.title} | ReNovel`} description={novel.catchphrase ?? undefined}>
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-2xl px-6 py-12">
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="rounded bg-muted px-2 py-0.5">{STATUS_LABEL[novel.publicationStatus]}</span>
          {isOwner ? (
            <span class="rounded bg-muted px-2 py-0.5">{VISIBILITY_LABEL[novel.visibility]}</span>
          ) : null}
        </div>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight">{novel.title}</h1>
        {novel.catchphrase ? <p class="mt-2 text-muted-foreground">{novel.catchphrase}</p> : null}
        <p class="mt-3 text-sm">
          <a class="text-primary underline underline-offset-4" href={`/@${author.handle}`}>
            {author.displayName}
          </a>
        </p>

        {novel.contentWarnings.length ? (
          <p class="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            コンテンツ警告: {novel.contentWarnings.join(' / ')}
          </p>
        ) : null}

        {novel.description ? (
          <p class="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{novel.description}</p>
        ) : null}

        {isOwner ? (
          <a
            href={`/studio/novels/${novel.id}`}
            class="mt-6 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            スタジオで編集
          </a>
        ) : null}

        <h2 class="mt-10 mb-2 text-sm font-medium text-muted-foreground">目次</h2>
        {episodes.length ? (
          <ol class="divide-y divide-border border-y border-border">
            {episodes.map((ep) => (
              <li>
                <a
                  class="flex items-baseline justify-between gap-3 py-3 hover:text-primary"
                  href={`/@${author.handle}/${novel.slug}/episodes/${ep.episodeNo}`}
                >
                  <span>
                    <span class="text-xs text-muted-foreground">第{ep.episodeNo}話</span> {ep.title}
                    {ep.status === 'draft' ? (
                      <span class="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">下書き</span>
                    ) : null}
                  </span>
                  <span class="shrink-0 text-xs text-muted-foreground">{ep.charCount}字</span>
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p class="text-sm text-muted-foreground">まだ公開されたエピソードはありません。</p>
        )}
      </main>
    </Layout>
  )
}
