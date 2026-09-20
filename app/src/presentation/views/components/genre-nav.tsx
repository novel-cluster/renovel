import type { FC } from 'hono/jsx'

/** Genre keys/labels shared across discovery surfaces (syosetu-style category strip). */
export const GENRE_NAV: [string, string][] = [
  ['fantasy', 'ファンタジー'],
  ['sf', 'SF'],
  ['romance', '恋愛'],
  ['mystery', 'ミステリー'],
  ['horror', 'ホラー'],
  ['literary', '文芸'],
  ['essay', 'エッセイ'],
  ['other', 'その他'],
]

export const GENRE_LABEL = Object.fromEntries(GENRE_NAV) as Record<string, string>

/** Horizontal genre navigation bar shown under the header on discovery pages. */
export const GenreNav: FC<{ active?: string }> = ({ active }) => (
  <nav class="border-b border-border bg-muted/40">
    <ul class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-6 py-2 text-sm">
      <li>
        <a
          class={`rounded px-2 py-1 hover:bg-muted ${
            active ? 'text-muted-foreground hover:text-foreground' : 'font-medium text-foreground'
          }`}
          href="/search"
        >
          総合
        </a>
      </li>
      {GENRE_NAV.map(([key, label]) => (
        <li>
          <a
            class={`rounded px-2 py-1 hover:bg-muted hover:text-foreground ${
              active === key ? 'font-medium text-foreground' : 'text-muted-foreground'
            }`}
            href={`/search?genre=${key}`}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
)
