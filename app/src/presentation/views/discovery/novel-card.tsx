import type { FC } from 'hono/jsx'
import type { NovelCard } from '@/domain/discovery/discovery'

const STATUS_LABEL = { ongoing: '連載中', completed: '完結', hiatus: '休載中' } as const

/** Reusable grid of novel cards for discovery lists. */
export const NovelCardGrid: FC<{ novels: NovelCard[]; empty?: string }> = ({ novels, empty }) => {
  if (!novels.length) {
    return <p class="text-sm text-muted-foreground">{empty ?? '作品がありません。'}</p>
  }
  return (
    <ul class="grid gap-4 sm:grid-cols-2">
      {novels.map((n) => (
        <li class="rounded-lg border border-border p-4">
          <a
            href={`/@${n.authorHandle}/${n.slug}`}
            class="font-medium tracking-tight hover:text-primary"
          >
            {n.title}
          </a>
          {n.catchphrase ? (
            <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.catchphrase}</p>
          ) : null}
          <div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span class="rounded bg-muted px-1.5 py-0.5">{STATUS_LABEL[n.publicationStatus]}</span>
            <a class="hover:text-primary" href={`/@${n.authorHandle}`}>
              {n.authorName}
            </a>
            <span>♥ {n.likeCount}</span>
            {n.starCount > 0 ? <span>★ {n.starAvg.toFixed(2)}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
