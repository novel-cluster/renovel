import { raw } from 'hono/html'
import type { FC } from 'hono/jsx'
import type { EpisodeEditor } from '@/application/services/writing/edit-episode.query'
import type { AuthUser } from '@/presentation/env'
import { Field, FormError } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'
import { renderNovelBody } from '../reading/render-body'

/**
 * Studio episode editor. Plain-text body; manual save records a revision. Live
 * autosave/preview island is a later enhancement — this renders the saved body.
 */
export const EditorPage: FC<{
  view: EpisodeEditor
  viewer: AuthUser
  error?: string
  saved?: boolean
}> = ({ view, viewer, error, saved }) => {
  const { novel, episode } = view
  const action = `/studio/novels/${novel.id}/episodes/${episode.id}`
  return (
    <Layout title={`${episode.title} | エディタ`}>
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-3xl px-6 py-10">
        <p class="text-sm text-muted-foreground">
          <a class="hover:text-primary" href={`/studio/novels/${novel.id}`}>
            ← {novel.title}
          </a>
        </p>

        <form method="post" action={action} class="mt-4 space-y-4">
          <FormError message={error} />
          {saved ? (
            <p class="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">保存しました。</p>
          ) : null}
          <Field label="タイトル" name="title" value={episode.title} required />
          <label class="block">
            <span class="mb-1 block text-sm font-medium">
              本文（プレーンテキスト。ルビ <code>｜文章《ルビ》</code> / 傍点{' '}
              <code>《《文章》》</code>）
            </span>
            <textarea
              name="body"
              rows={18}
              class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed"
            >
              {episode.body}
            </textarea>
          </label>
          <button
            type="submit"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            保存（履歴に記録）
          </button>
        </form>

        <div class="mt-4 flex items-center gap-4 text-sm">
          {episode.status === 'draft' ? (
            <form method="post" action={`${action}/publish`}>
              <button
                type="submit"
                class="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                公開する
              </button>
            </form>
          ) : (
            <a
              class="text-primary underline underline-offset-4"
              href={`/@${viewer.handle}/${novel.slug}/episodes/${episode.episodeNo}`}
            >
              公開ページを見る
            </a>
          )}
          <span class="text-muted-foreground">
            {episode.status === 'draft' ? '下書き' : '公開中'}
          </span>
        </div>

        <section class="mt-10">
          <h2 class="mb-2 text-sm font-medium text-muted-foreground">プレビュー（保存済み本文）</h2>
          <article class="novel-body rounded-md border border-border px-5 py-4 leading-loose">
            {raw(renderNovelBody(episode.body))}
          </article>
        </section>
      </main>
    </Layout>
  )
}
