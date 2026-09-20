import type { FC } from 'hono/jsx'
import type { NovelCard } from '@/domain/discovery/discovery'
import { GENRE_LABEL } from '@/presentation/views/components/genre-nav'

const STATUS_LABEL = { ongoing: '連載中', completed: '完結', hiatus: '休載中' } as const

/** Numbered ranking list — the signature syosetu-style ranked table. */
export const RankingList: FC<{ novels: NovelCard[]; empty?: string; startRank?: number }> = ({
  novels,
  empty,
  startRank = 1,
}) => {
  if (!novels.length) {
    return (
      <p class="text-sm text-muted-foreground">{empty ?? 'まだランキングデータがありません。'}</p>
    )
  }
  return (
    <ol class="divide-y divide-border rounded-lg border border-border">
      {novels.map((n, i) => {
        const rank = startRank + i
        const badge =
          rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        return (
          <li class="flex items-start gap-3 p-3">
            <span
              class={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${badge}`}
            >
              {rank}
            </span>
            <div class="min-w-0 flex-1">
              <a
                href={`/@${n.authorHandle}/${n.slug}`}
                class="font-medium tracking-tight hover:text-primary"
              >
                {n.title}
              </a>
              {n.catchphrase ? (
                <p class="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{n.catchphrase}</p>
              ) : null}
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {n.genre ? (
                  <span class="rounded bg-muted px-1.5 py-0.5">
                    {GENRE_LABEL[n.genre] ?? n.genre}
                  </span>
                ) : null}
                <span class="rounded bg-muted px-1.5 py-0.5">
                  {STATUS_LABEL[n.publicationStatus]}
                </span>
                <a class="hover:text-primary" href={`/@${n.authorHandle}`}>
                  {n.authorName}
                </a>
                <span>♥ {n.likeCount}</span>
                {n.starCount > 0 ? <span>★ {n.starAvg.toFixed(2)}</span> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
