import type { FC } from 'hono/jsx'
import { Field, FormError, SubmitButton } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

export const SignupPage: FC<{
  error?: string
  handle?: string
  displayName?: string
  email?: string
}> = ({ error, handle, displayName, email }) => (
  <Layout title="新規登録 | ReNovel">
    <SiteHeader user={null} />
    <main class="mx-auto max-w-sm px-6 py-16">
      <h1 class="text-2xl font-semibold tracking-tight">新規登録</h1>
      <form method="post" action="/signup" class="mt-6 space-y-4">
        <FormError message={error} />
        <Field
          label="ハンドル"
          name="handle"
          value={handle}
          autocomplete="username"
          help="3〜30文字の英小文字・数字・アンダースコア。プロフィールURL /@handle になります。"
          required
        />
        <Field label="表示名" name="displayName" value={displayName} required />
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
          autocomplete="new-password"
          help="8文字以上"
          required
        />
        <SubmitButton label="登録する" />
      </form>
      <p class="mt-6 text-sm text-muted-foreground">
        すでにアカウントをお持ちですか？{' '}
        <a class="font-medium text-primary underline underline-offset-4" href="/login">
          ログイン
        </a>
      </p>
    </main>
  </Layout>
)
