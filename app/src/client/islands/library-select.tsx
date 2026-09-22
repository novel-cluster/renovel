/** @jsxImportSource hono/jsx/dom */
import { useState } from 'hono/jsx'

const OPTIONS: [string, string][] = [
  ['reading', '読んでいる'],
  ['read_later', '後で読む'],
  ['completed', '読み終わった'],
  ['favorite', 'お気に入り'],
]

export interface LibrarySelectProps {
  novelId: string
  /** Current library state, or null if not in the library. */
  state: string | null
}

/**
 * Add/update a novel in the reader's library as a client island — no full page
 * reload. Posts to /library and reflects the saved state inline.
 */
export function LibrarySelect({ novelId, state: state0 }: LibrarySelectProps) {
  const [state, setState] = useState(state0 ?? 'reading')
  const [saved, setSaved] = useState(state0 != null)
  const [busy, setBusy] = useState(false)

  async function submit(e: Event) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/library', {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new URLSearchParams({ novelId, state }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setSaved(true)
    } catch {
      // keep the form usable; the user can retry
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} class="flex items-center gap-2">
      <select
        value={state}
        onChange={(e: Event) => setState((e.currentTarget as HTMLSelectElement).value)}
        class="rounded-md border border-input bg-background px-2 py-2 text-sm"
      >
        {OPTIONS.map(([v, l]) => (
          <option value={v} selected={v === state}>
            {l}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy}
        class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
      >
        {saved ? '本棚を更新' : '本棚に追加'}
      </button>
    </form>
  )
}
