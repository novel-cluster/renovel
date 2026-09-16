import { raw } from 'hono/html'
import type { FC } from 'hono/jsx'
import type { EpisodeReadView } from '@/application/services/reading/read-novel.query'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'
import { renderNovelBody } from './render-body'

/** Public episode reading page (routing.md §3.1, PRD §17). */
export const EpisodePage: FC<{ view: EpisodeReadView; viewer: AuthUser | null }> = ({
  view,
  viewer,
}) => {
  const { novel, author, episode, prevNo, nextNo } = view
  const base = `/@${author.handle}/${novel.slug}`
  return (
    <Layout title={`${episode.title} | ${novel.title} | ReNovel`}>
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-2xl px-6 py-12">
        <p class="text-sm text-muted-foreground">
          <a class="hover:text-primary" href={base}>
            {novel.title}
          </a>
        </p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight">
          <span class="text-sm text-muted-foreground">第{episode.episodeNo}話</span> {episode.title}
          {episode.status === 'draft' ? (
            <span class="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-xs">
              下書きプレビュー
            </span>
          ) : null}
        </h1>

        <article class="novel-body mt-8 text-[1.05rem] leading-loose">
          {raw(renderNovelBody(episode.body))}
        </article>

        <nav class="mt-12 flex justify-between border-t border-border pt-6 text-sm">
          {prevNo ? (
            <a class="hover:text-primary" href={`${base}/episodes/${prevNo}`}>
              ← 前の話
            </a>
          ) : (
            <span />
          )}
          {nextNo ? (
            <a class="hover:text-primary" href={`${base}/episodes/${nextNo}`}>
              次の話 →
            </a>
          ) : (
            <a class="hover:text-primary" href={base}>
              目次へ
            </a>
          )}
        </nav>
      </main>
    </Layout>
  )
}
