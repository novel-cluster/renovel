import type { FC, PropsWithChildren } from 'hono/jsx'

type LayoutProps = PropsWithChildren<{
  title?: string
  description?: string
}>

/**
 * Base SSR document. Links the Tailwind build produced by `bun run css`
 * (served from /styles.css). Reader-facing pages should keep client JS out of
 * here — interactivity is added as islands per page (see docs/design/frontend.md).
 */
export const Layout: FC<LayoutProps> = ({ title = 'ReNovel', description, children }) => (
  <html lang="ja" class="h-full">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body class="min-h-full bg-background text-foreground antialiased">{children}</body>
  </html>
)
