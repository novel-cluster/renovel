import type { FC } from 'hono/jsx'
import { Layout } from './layout'

/**
 * Placeholder home page for Phase 0 — proves SSR + Tailwind render end-to-end.
 * Replaced by the real reader Home (PRD §28) in Phase 3 / Phase 5.
 */
export const HomePage: FC = () => (
  <Layout
    title="ReNovel"
    description="Web小説を読む読者を第一に、作者へ高度な執筆・共同制作・分析機能を提供する小説投稿プラットフォーム。"
  >
    <main class="mx-auto flex min-h-svh max-w-2xl flex-col justify-center px-6 py-24">
      <p class="text-sm font-medium text-muted-foreground">Phase 0 — Foundation</p>
      <h1 class="mt-3 text-4xl font-semibold tracking-tight">ReNovel</h1>
      <p class="mt-4 text-balance text-foreground-muted">
        書き、公開し、読まれ方を知り、他者と作品を作れる場所。
      </p>
      <p class="mt-8 text-sm text-muted-foreground">
        基盤が起動しています。ヘルスチェックは{' '}
        <a class="font-medium text-primary underline underline-offset-4" href="/health">
          /health
        </a>{' '}
        を参照してください。
      </p>
    </main>
  </Layout>
)
