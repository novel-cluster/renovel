/** @jsxImportSource hono/jsx/dom */
import { useState } from 'hono/jsx'

export interface StarRatingProps {
  /** POST endpoint that sets the star and returns `{ value, avg, count }`. */
  action: string
  /** The viewer's current star (0 = not rated). */
  value: number
}

/**
 * 1–3 star rating (novel) as a client island — sets the rating via fetch with no
 * full page reload. Best-effort: also refreshes the aggregate display if present.
 */
export function StarRating({ action, value: value0 }: StarRatingProps) {
  const [value, setValue] = useState(value0)
  const [busy, setBusy] = useState(false)

  async function setStar(v: number) {
    if (busy) return
    const prev = value
    setValue(v)
    setBusy(true)
    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new URLSearchParams({ value: String(v) }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { value: number; avg: number; count: number }
      setValue(data.value)
      const agg = document.getElementById('novel-star-agg')
      if (agg) agg.textContent = `★ ${data.avg.toFixed(2)}（${data.count}）`
    } catch {
      setValue(prev)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span class="flex items-center gap-2">
      {[1, 2, 3].map((v) => (
        <button
          type="button"
          onClick={() => setStar(v)}
          disabled={busy}
          aria-pressed={value === v}
          class="rounded-md border border-border px-3 py-1 hover:bg-muted aria-pressed:border-primary aria-pressed:text-primary disabled:opacity-60"
        >
          {'★'.repeat(v)}
        </button>
      ))}
    </span>
  )
}
