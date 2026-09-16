import type { FC } from 'hono/jsx'
import type { StudioNovel } from '@/application/services/novel/studio-novels.query'
import type { AuthUser } from '@/presentation/env'
import { Field, FormError, SubmitButton } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const GENRES: [string, string][] = [
  ['', '未設定'],
  ['fantasy', 'ファンタジー'],
  ['sf', 'SF'],
  ['romance', '恋愛'],
  ['mystery', 'ミステリー'],
  ['horror', 'ホラー'],
  ['literary', '文芸'],
  ['essay', 'エッセイ'],
  ['other', 'その他'],
]
const VISIBILITIES: [string, string][] = [
  ['private', '非公開'],
  ['unlisted', '限定公開'],
  ['public', '公開'],
]
const STATUSES: [string, string][] = [
  ['ongoing', '連載中'],
  ['completed', '完結'],
  ['hiatus', '休載中'],
]

const Select: FC<{ label: string; name: string; value: string; options: [string, string][] }> = ({
  label,
  name,
  value,
  options,
}) => (
  <label class="block">
    <span class="mb-1 block text-sm font-medium">{label}</span>
    <select
      name={name}
      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      {options.map(([v, l]) => (
        <option value={v} selected={v === value}>
          {l}
        </option>
      ))}
    </select>
  </label>
)

/** Studio dashboard: settings form + episode list (owner only). */
export const NovelDashboardPage: FC<{
  view: StudioNovel
  viewer: AuthUser
  tags: string[]
  error?: string
  saved?: boolean
}> = ({ view, viewer, tags, error, saved }) => {
  const { novel, episodes } = view
  return (
    <Layout title={`${novel.title} | スタジオ`}>
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-2xl px-6 py-12">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-semibold tracking-tight">{novel.title}</h1>
          <a
            class="text-sm text-primary underline underline-offset-4"
            href={`/@${viewer.handle}/${novel.slug}`}
          >
            公開ページを見る
          </a>
        </div>

        <form method="post" action={`/studio/novels/${novel.id}`} class="mt-6 space-y-4">
          <FormError message={error} />
          {saved ? (
            <p class="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">保存しました。</p>
          ) : null}
          <Field label="タイトル" name="title" value={novel.title} required />
          <Field label="キャッチコピー" name="catchphrase" value={novel.catchphrase ?? ''} />
          <label class="block">
            <span class="mb-1 block text-sm font-medium">あらすじ</span>
            <textarea
              name="description"
              rows={4}
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {novel.description ?? ''}
            </textarea>
          </label>
          <Select label="ジャンル" name="genre" value={novel.genre ?? ''} options={GENRES} />
          <Select
            label="公開設定"
            name="visibility"
            value={novel.visibility}
            options={VISIBILITIES}
          />
          <Select
            label="連載状態"
            name="publicationStatus"
            value={novel.publicationStatus}
            options={STATUSES}
          />
          <Field
            label="コンテンツ警告"
            name="contentWarnings"
            value={novel.contentWarnings.join(', ')}
            help="カンマ区切り（例: r15, violence）"
          />
          <Field
            label="タグ"
            name="tags"
            value={tags.join(', ')}
            help="カンマ区切り・最大10件（検索・発見に使われます）"
          />
          <SubmitButton label="設定を保存" />
        </form>

        <section class="mt-12">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium">エピソード</h2>
            <form method="post" action={`/studio/novels/${novel.id}/episodes`}>
              <button
                type="submit"
                class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                新規エピソード
              </button>
            </form>
          </div>
          {episodes.length ? (
            <ol class="mt-4 divide-y divide-border border-y border-border">
              {episodes.map((ep) => (
                <li>
                  <a
                    class="flex items-center justify-between gap-3 py-3 hover:text-primary"
                    href={`/studio/novels/${novel.id}/episodes/${ep.id}`}
                  >
                    <span>
                      <span class="text-xs text-muted-foreground">第{ep.episodeNo}話</span>{' '}
                      {ep.title}
                    </span>
                    <span class="shrink-0 text-xs text-muted-foreground">
                      {ep.status === 'draft' ? '下書き' : '公開'} · {ep.charCount}字
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p class="mt-4 text-sm text-muted-foreground">
              まだエピソードがありません。「新規エピソード」から書き始めましょう。
            </p>
          )}
        </section>
      </main>
    </Layout>
  )
}
