import type { FC } from 'hono/jsx'
import type { NovelReadView } from '@/application/services/reading/read-novel.query'
import type { LibraryState } from '@/domain/reading/entities/reading'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

const STATUS_LABEL = { ongoing: '連載中', completed: '完結', hiatus: '休載中' } as const
const VISIBILITY_LABEL = { public: '公開', unlisted: '限定公開', private: '非公開' } as const
const LIBRARY_OPTIONS: [LibraryState, string][] = [
  ['reading', '読んでいる'],
  ['read_later', '後で読む'],
  ['completed', '読み終わった'],
  ['favorite', 'お気に入り'],
]

/** Public novel page with table of contents (routing.md §3.1). */
export const NovelPage: FC<{
  view: NovelReadView
  viewer: AuthUser | null
  resumeEpisodeNo?: number | null
  libraryState?: LibraryState | null
}> = ({ view, viewer, resumeEpisodeNo, libraryState }) => {
  const { novel, author, episodes, isOwner } = view
  const base = `/@${author.handle}/${novel.slug}`
  const firstNo = episodes[0]?.episodeNo ?? null
  const resumeNo = resumeEpisodeNo ?? null

  return (
    <Layout
      title={`${novel.title} | ReNovel`}
      description={novel.catchphrase ?? undefined}
      canonical={base}
      noindex={novel.visibility !== 'public'}
    >
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

        <div class="mt-6 flex flex-wrap items-center gap-3">
          {resumeNo ? (
            <a
              href={`${base}/episodes/${resumeNo}`}
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              続きから読む（第{resumeNo}話）
            </a>
          ) : firstNo ? (
            <a
              href={`${base}/episodes/${firstNo}`}
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              最初から読む
            </a>
          ) : null}

          {viewer ? (
            <LibraryControls base={base} novelId={novel.id} state={libraryState ?? null} />
          ) : null}

          {isOwner ? (
            <a
              href={`/studio/novels/${novel.id}`}
              class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              スタジオで編集
            </a>
          ) : null}
        </div>

        <h2 class="mt-10 mb-2 text-sm font-medium text-muted-foreground">目次</h2>
        {episodes.length ? (
          <ol class="divide-y divide-border border-y border-border">
            {episodes.map((ep) => (
              <li>
                <a
                  class="flex items-baseline justify-between gap-3 py-3 hover:text-primary"
                  href={`${base}/episodes/${ep.episodeNo}`}
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

const LibraryControls: FC<{ base: string; novelId: string; state: LibraryState | null }> = ({
  novelId,
  state,
}) => (
  <form method="post" action="/library" class="flex items-center gap-2">
    <input type="hidden" name="novelId" value={novelId} />
    <select name="state" class="rounded-md border border-input bg-background px-2 py-2 text-sm">
      {LIBRARY_OPTIONS.map(([v, l]) => (
        <option value={v} selected={v === state}>
          {l}
        </option>
      ))}
    </select>
    <button type="submit" class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
      {state ? '本棚を更新' : '本棚に追加'}
    </button>
  </form>
)
