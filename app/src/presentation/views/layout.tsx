import type { Child, FC, PropsWithChildren } from 'hono/jsx'

type LayoutProps = PropsWithChildren<{
  title?: string
  description?: string
  /** Canonical path (routing.md §6). Emits `<link rel=canonical>` + OGP url. */
  canonical?: string
  /** `true` → `<meta name=robots content="noindex,nofollow">` (SEO, frontend.md §7). */
  noindex?: boolean
  /** Extra tags injected into `<head>` (e.g. a page-specific island script). */
  head?: Child
}>

/**
 * Base SSR document. Links the Tailwind build produced by `bun run css`
 * (served from /styles.css). Reader-facing pages keep client JS out of here —
 * interactivity is added as islands per page (docs/design/overview/frontend.md).
 */
export const Layout: FC<LayoutProps> = ({
  title = 'ReNovel',
  description,
  canonical,
  noindex,
  head,
  children,
}) => (
  <html lang="ja" class="h-full">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <link rel="stylesheet" href="/styles.css" />
      {head}
    </head>
    <body class="min-h-full bg-background text-foreground antialiased">{children}</body>
  </html>
)
