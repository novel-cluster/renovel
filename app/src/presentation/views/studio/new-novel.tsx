import type { FC } from 'hono/jsx'
import type { AuthUser } from '@/presentation/env'
import { Field, FormError, SubmitButton } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

/** New novel form. Starts Private; the slug is auto-generated. */
export const NewNovelPage: FC<{ viewer: AuthUser; error?: string }> = ({ viewer, error }) => (
  <Layout title="新規作品 | ReNovel">
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-lg px-6 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">新規作品</h1>
      <form method="post" action="/studio/novels" class="mt-6 space-y-4">
        <FormError message={error} />
        <Field label="タイトル" name="title" required />
        <p class="text-xs text-muted-foreground">
          作成後は非公開で始まります。公開設定・あらすじは作成後に編集できます。
        </p>
        <SubmitButton label="作品を作成" />
      </form>
    </main>
  </Layout>
)
