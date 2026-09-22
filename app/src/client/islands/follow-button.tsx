/** @jsxImportSource hono/jsx/dom */
import { useState } from 'hono/jsx'

export interface FollowButtonProps {
  /** POST endpoint that toggles the follow and returns `{ following }`. */
  action: string
  following: boolean
}

/**
 * Follow/unfollow toggle (user or novel) as a client island — no full page
 * reload. Optimistic with rollback on failure.
 */
export function FollowButton({ action, following: following0 }: FollowButtonProps) {
  const [following, setFollowing] = useState(following0)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    const prev = following
    setFollowing(!prev)
    setBusy(true)
    try {
      const res = await fetch(action, { method: 'POST', headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { following: boolean }
      setFollowing(data.following)
    } catch {
      setFollowing(prev)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted aria-pressed:border-primary aria-pressed:text-primary disabled:opacity-60"
    >
      {following ? 'フォロー中' : 'フォロー'}
    </button>
  )
}
