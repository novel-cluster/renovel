import type { FC } from 'hono/jsx'
import type { User } from '@/domain/identity/entities/user'
import type { AuthUser } from '@/presentation/env'
import { Field, FormError, SubmitButton } from '@/presentation/views/components/form'
import { SiteHeader } from '@/presentation/views/components/site-header'
import { Layout } from '@/presentation/views/layout'

/** Account/profile edit form (PRD §6). */
export const AccountSettingsPage: FC<{
  profile: User
  viewer: AuthUser
  error?: string
  saved?: boolean
}> = ({ profile, viewer, error, saved }) => (
  <Layout title="アカウント設定 | ReNovel">
    <SiteHeader user={viewer} />
    <main class="mx-auto max-w-lg px-6 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">アカウント設定</h1>

      <form method="post" action="/settings/account" class="mt-6 space-y-4">
        <FormError message={error} />
        {saved ? (
          <p class="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">保存しました。</p>
        ) : null}

        <div class="text-sm text-muted-foreground">
          ハンドル: <span class="font-medium text-foreground">@{profile.handle}</span>
          <span class="ml-2 text-xs">（変更は今後対応）</span>
        </div>

        <Field label="表示名" name="displayName" value={profile.displayName} required />

        <label class="block">
          <span class="mb-1 block text-sm font-medium">自己紹介</span>
          <textarea
            name="bio"
            rows={5}
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {profile.bio ?? ''}
          </textarea>
        </label>

        <SubmitButton label="保存する" />
      </form>

      <p class="mt-6 text-sm">
        <a class="text-primary underline underline-offset-4" href={`/@${profile.handle}`}>
          プロフィールを表示
        </a>
      </p>
    </main>
  </Layout>
)
