/** @jsxImportSource hono/jsx/dom */
import { useState } from 'hono/jsx'

export interface LibraryRemoveProps {
  novelId: string
}

/**
 * Remove a novel from the library (library page) as a client island — drops the
 * row in place without a full page reload.
 */
export function LibraryRemove({ novelId }: LibraryRemoveProps) {
  const [busy, setBusy] = useState(false)

  async function remove(e: Event) {
    if (busy) return
    setBusy(true)
    const btn = e.currentTarget as HTMLElement
    try {
      const res = await fetch('/library/remove', {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new URLSearchParams({ novelId }),
      })
      if (!res.ok) throw new Error(String(res.status))
      btn.closest('li')?.remove()
    } catch {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      class="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-60"
    >
      外す
    </button>
  )
}
