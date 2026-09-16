import type { FC } from 'hono/jsx'
import type { AuthUser } from '@/presentation/env'

/** Global header with auth-aware navigation. */
export const SiteHeader: FC<{ user: AuthUser | null }> = ({ user }) => (
  <header class="border-b border-border">
    <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
      <a href="/" class="text-lg font-semibold tracking-tight">
        ReNovel
      </a>
      <nav class="flex items-center gap-4 text-sm">
        <a class="text-muted-foreground hover:text-foreground" href="/ranking">
          ランキング
        </a>
        <a class="text-muted-foreground hover:text-foreground" href="/search">
          探す
        </a>
        {user ? (
          <>
            <a class="text-muted-foreground hover:text-foreground" href="/studio">
              スタジオ
            </a>
            <a class="text-muted-foreground hover:text-foreground" href="/library">
              本棚
            </a>
            <a class="text-muted-foreground hover:text-foreground" href="/notifications">
              通知
            </a>
            <a class="text-muted-foreground hover:text-foreground" href={`/@${user.handle}`}>
              @{user.handle}
            </a>
            <a class="text-muted-foreground hover:text-foreground" href="/settings/account">
              設定
            </a>
            <form method="post" action="/logout" class="inline">
              <button type="submit" class="text-muted-foreground hover:text-foreground">
                ログアウト
              </button>
            </form>
          </>
        ) : (
          <>
            <a class="text-muted-foreground hover:text-foreground" href="/login">
              ログイン
            </a>
            <a
              class="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
              href="/signup"
            >
              新規登録
            </a>
          </>
        )}
      </nav>
    </div>
  </header>
)
