import type { FC } from 'hono/jsx'
import { Field, FormError, SubmitButton } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

export const LoginPage: FC<{ error?: string; redirect?: string; email?: string }> = ({
  error,
  redirect,
  email,
}) => (
  <Layout title="ログイン | ReNovel">
    <SiteHeader user={null} />
    <main class="mx-auto max-w-sm px-6 py-16">
      <h1 class="text-2xl font-semibold tracking-tight">ログイン</h1>
      <form method="post" action="/login" class="mt-6 space-y-4">
        <FormError message={error} />
        {redirect ? <input type="hidden" name="redirect" value={redirect} /> : null}
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          value={email}
          autocomplete="email"
          required
        />
        <Field
          label="パスワード"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <SubmitButton label="ログイン" />
      </form>
      <p class="mt-6 text-sm text-muted-foreground">
        アカウントがありませんか？{' '}
        <a class="font-medium text-primary underline underline-offset-4" href="/signup">
          新規登録
        </a>
      </p>
    </main>
  </Layout>
)
