/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'
import { FollowButton } from './islands/follow-button'
import { LibraryRemove } from './islands/library-remove'
import { LibrarySelect } from './islands/library-select'
import { LikeButton } from './islands/like-button'
import { StarRating } from './islands/star-rating'

// Island registry. Each interactive element is SSR'd with a no-JS fallback and a
// `data-island` marker; this bootstrap hydrates it into a reactive component so
// the action runs via fetch (no full page reload). Only pages that emit these
// markers load this script (frontend.md §5).
// biome-ignore lint/suspicious/noExplicitAny: props are validated per-component
const REGISTRY: Record<string, (props: any) => unknown> = {
  like: LikeButton,
  follow: FollowButton,
  star: StarRating,
  library: LibrarySelect,
  'library-remove': LibraryRemove,
}

function mount() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const name = el.dataset.island
    const Component = name ? REGISTRY[name] : undefined
    if (!Component) continue
    let props: Record<string, unknown> = {}
    try {
      props = JSON.parse(el.dataset.props || '{}')
    } catch {
      continue
    }
    render(<Component {...props} />, el)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
