/** @jsxImportSource hono/jsx/dom */
import { useState } from 'hono/jsx'

export interface LikeButtonProps {
  /** POST endpoint that toggles the like and returns `{ liked }`. */
  action: string
  liked: boolean
  count: number
}

/**
 * Episode like toggle as a client island — avoids a full page reload (and the
 * re-render of the whole episode body + comments) on every like. Optimistic:
 * updates instantly, reverts on failure.
 */
export function LikeButton({ action, liked: liked0, count: count0 }: LikeButtonProps) {
  const [liked, setLiked] = useState(liked0)
  const [count, setCount] = useState(count0)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    const prevLiked = liked
    const prevCount = count
    const next = !liked
    setLiked(next)
    setCount(prevCount + (next ? 1 : -1))
    setBusy(true)
    try {
      const res = await fetch(action, { method: 'POST', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { liked: boolean }
      // Trust the server for the final liked state; keep the count consistent.
      setLiked(data.liked)
      setCount(prevCount + (data.liked ? 1 : 0) - (prevLiked ? 1 : 0))
    } catch {
      setLiked(prevLiked)
      setCount(prevCount)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      class="rounded-md border border-border px-3 py-1.5 hover:bg-muted aria-pressed:border-primary aria-pressed:text-primary disabled:opacity-60"
    >
      ♥ {count}
    </button>
  )
}
