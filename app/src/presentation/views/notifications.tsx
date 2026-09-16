import type { FC } from 'hono/jsx'
import type { NotificationView } from '@/domain/notification/notification'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

/** Builds the display message + target link for one notification. */
function render(n: NotificationView, viewerHandle: string): { text: string; href: string | null } {
  const p = n.payload
  const actor = n.actorName ?? '誰か'
  // For like/star/review/comment/novel_follow the recipient IS the author.
  const authorBase = p.novelSlug ? `/@${viewerHandle}/${p.novelSlug}` : null
  const ep = p.episodeNo != null && authorBase ? `${authorBase}/episodes/${p.episodeNo}` : null
  switch (n.type) {
    case 'like':
      return {
        text: `${actor}さんが「${p.novelTitle}」第${p.episodeNo}話にいいねしました`,
        href: ep,
      }
    case 'star':
      return { text: `${actor}さんが「${p.novelTitle}」を評価しました`, href: authorBase }
    case 'review':
      return { text: `${actor}さんが「${p.novelTitle}」にレビューを書きました`, href: authorBase }
    case 'comment':
      return {
        text: `${actor}さんが「${p.novelTitle}」第${p.episodeNo}話にコメントしました`,
        href: ep,
      }
    case 'user_follow':
      return {
        text: `${actor}さんがあなたをフォローしました`,
        href: n.actorHandle ? `/@${n.actorHandle}` : null,
      }
    case 'novel_follow':
      return { text: `${actor}さんが「${p.novelTitle}」をフォローしました`, href: authorBase }
    case 'novel_update': {
      const href =
        n.actorHandle && p.novelSlug
          ? `/@${n.actorHandle}/${p.novelSlug}/episodes/${p.episodeNo}`
          : null
      return { text: `「${p.novelTitle}」第${p.episodeNo}話が公開されました`, href }
    }
    default:
      return { text: p.message ?? '新しい通知があります', href: null }
  }
}

/** In-app notifications (PRD §22). Private page → noindex. */
export const NotificationsPage: FC<{ items: NotificationView[]; viewer: AuthUser }> = ({
  items,
  viewer,
}) => (
  <Layout title="通知 | ReNovel" noindex>
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-2xl px-6 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">通知</h1>
      {items.length ? (
        <ul class="mt-6 divide-y divide-border border-y border-border">
          {items.map((n) => {
            const r = render(n, viewer.handle)
            return (
              <li class={`py-3 text-sm ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>
                {r.href ? (
                  <a class="hover:text-primary" href={r.href}>
                    {r.text}
                  </a>
                ) : (
                  <span>{r.text}</span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p class="mt-6 text-sm text-muted-foreground">通知はまだありません。</p>
      )}
    </main>
  </Layout>
)
