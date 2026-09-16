import { raw } from 'hono/html'
import type { FC } from 'hono/jsx'
import type { EpisodeReadView } from '@/application/services/reading/read-novel.query'
import type { EpisodeSocial } from '@/application/services/social/social.query'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'
import { renderNovelBody } from './render-body'

const btn =
  'rounded-md border border-border px-2 py-1 text-xs hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground'

/** Public episode reading page (routing.md §3.1, PRD §17). */
export const EpisodePage: FC<{
  view: EpisodeReadView
  viewer: AuthUser | null
  social: EpisodeSocial
}> = ({ view, viewer, social }) => {
  const { novel, author, episode, prevNo, nextNo } = view
  const base = `/@${author.handle}/${novel.slug}`
  const canonical = `${base}/episodes/${episode.episodeNo}`
  const indexable =
    novel.visibility === 'public' &&
    episode.status === 'published' &&
    (episode.visibility === null || episode.visibility === 'public')

  return (
    <Layout
      title={`${episode.title} | ${novel.title} | ReNovel`}
      canonical={canonical}
      noindex={!indexable}
      head={<script src="/static/reader-settings.js" defer />}
    >
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-2xl px-6 py-10">
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

        <div class="mt-6 flex flex-wrap items-center gap-2 border-y border-border py-2">
          <span class="text-xs text-muted-foreground">文字</span>
          <button type="button" class={btn} data-action="fs-dec">
            A−
          </button>
          <button type="button" class={btn} data-action="fs-inc">
            A＋
          </button>
          <span class="ml-3 text-xs text-muted-foreground">テーマ</span>
          <button type="button" class={btn} data-theme="light">
            標準
          </button>
          <button type="button" class={btn} data-theme="sepia">
            セピア
          </button>
          <button type="button" class={btn} data-theme="dark">
            ダーク
          </button>
          <button type="button" class={`${btn} ml-3`} data-action="vertical">
            縦書き
          </button>
        </div>

        <article id="reader-body" class="novel-body mt-8 text-[1.05rem] leading-loose">
          {raw(renderNovelBody(episode.body))}
        </article>

        <nav class="mt-12 flex items-center justify-between border-t border-border pt-6 text-sm">
          {prevNo ? (
            <a class="hover:text-primary" href={`${base}/episodes/${prevNo}`}>
              ← 前の話
            </a>
          ) : (
            <span />
          )}

          {viewer && episode.status === 'published' ? (
            <form method="post" action={`/episodes/${episode.id}/like`}>
              <button
                type="submit"
                aria-pressed={social.liked}
                class="rounded-md border border-border px-3 py-1.5 hover:bg-muted aria-pressed:border-primary aria-pressed:text-primary"
              >
                ♥ {social.likeCount}
              </button>
            </form>
          ) : (
            <span class="text-muted-foreground">♥ {social.likeCount}</span>
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

        <section class="mt-12">
          <h2 class="mb-3 text-sm font-medium text-muted-foreground">
            コメント（{social.comments.length}）
          </h2>
          {viewer && episode.status === 'published' ? (
            <form method="post" action={`/episodes/${episode.id}/comments`} class="mb-6 space-y-2">
              <textarea
                name="body"
                rows={3}
                required
                placeholder="読み終えた感想を書く"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                コメントする
              </button>
            </form>
          ) : null}
          {social.comments.length ? (
            <ul class="space-y-4">
              {social.comments.map((cm) => (
                <li class="text-sm">
                  <div class="text-xs text-muted-foreground">
                    <a class="hover:text-primary" href={`/@${cm.authorHandle}`}>
                      {cm.authorName}
                    </a>
                  </div>
                  <p class="mt-1 whitespace-pre-wrap">
                    {cm.deleted ? (
                      <span class="text-muted-foreground">削除されたコメント</span>
                    ) : (
                      cm.body
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p class="text-sm text-muted-foreground">まだコメントはありません。</p>
          )}
        </section>
      </main>
    </Layout>
  )
}
