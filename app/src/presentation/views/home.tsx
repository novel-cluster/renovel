import type { FC } from 'hono/jsx'
import type { AuthUser } from '@/presentation/env'
import { SiteHeader } from './components/site-header'
import { Layout } from './layout'

/**
 * Home page. Phase 1 shows an auth-aware landing; the real reader Home (PRD §28)
 * arrives in Phase 3 / Phase 5.
 */
export const HomePage: FC<{ user: AuthUser | null }> = ({ user }) => (
  <Layout
    title="ReNovel"
    description="Web小説を読む読者を第一に、作者へ高度な執筆・共同制作・分析機能を提供する小説投稿プラットフォーム。"
  >
    <SiteHeader user={user} />
    <main class="mx-auto flex min-h-[70svh] max-w-2xl flex-col justify-center px-6 py-24">
      <p class="text-sm font-medium text-muted-foreground">Reader First / Text First</p>
      <h1 class="mt-3 text-4xl font-semibold tracking-tight">ReNovel</h1>
      <p class="mt-4 text-balance text-muted-foreground">
        書き、公開し、読まれ方を知り、他者と作品を作れる場所。
      </p>
      {user ? (
        <p class="mt-8 text-sm text-muted-foreground">
          ようこそ、{user.displayName} さん。プロフィールは{' '}
          <a
            class="font-medium text-primary underline underline-offset-4"
            href={`/@${user.handle}`}
          >
            /@{user.handle}
          </a>
        </p>
      ) : (
        <div class="mt-8 flex gap-3">
          <a
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href="/signup"
          >
            はじめる
          </a>
          <a
            class="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            href="/login"
          >
            ログイン
          </a>
        </div>
      )}
    </main>
  </Layout>
)
