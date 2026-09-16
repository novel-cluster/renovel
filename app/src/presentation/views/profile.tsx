import type { FC } from 'hono/jsx'
import type { User } from '@/domain/identity/entities/user'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

/** Public user profile at `/@{handle}` (routing.md §3.1). */
export const ProfilePage: FC<{ profile: User; viewer: AuthUser | null; following?: boolean }> = ({
  profile,
  viewer,
  following,
}) => {
  const isOwner = viewer?.id === profile.id
  return (
    <Layout
      title={`${profile.displayName} (@${profile.handle}) | ReNovel`}
      description={profile.bio ?? undefined}
    >
      <SiteHeader user={viewer} />
      <main class="mx-auto max-w-2xl px-6 py-12">
        <div class="flex items-center gap-4">
          {profile.iconUrl ? (
            <img src={profile.iconUrl} alt="" class="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div class="h-16 w-16 rounded-full bg-muted" />
          )}
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
            <p class="text-sm text-muted-foreground">@{profile.handle}</p>
          </div>
          {isOwner ? (
            <a
              href="/settings/account"
              class="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              プロフィール編集
            </a>
          ) : viewer ? (
            <form method="post" action={`/users/${profile.id}/follow`} class="ml-auto">
              <button
                type="submit"
                aria-pressed={following}
                class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted aria-pressed:border-primary aria-pressed:text-primary"
              >
                {following ? 'フォロー中' : 'フォロー'}
              </button>
            </form>
          ) : null}
        </div>

        {profile.bio ? (
          <p class="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {profile.bio}
          </p>
        ) : null}

        {profile.externalLinks.length ? (
          <ul class="mt-6 space-y-1">
            {profile.externalLinks.map((link) => (
              <li>
                <a
                  class="text-sm text-primary underline underline-offset-4"
                  href={link.url}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <p class="mt-10 text-xs text-muted-foreground">
          まだ作品はありません（作品は Phase 2 で実装予定）。
        </p>
      </main>
    </Layout>
  )
}
