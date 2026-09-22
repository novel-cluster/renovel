/** @jsxImportSource hono/jsx/dom */
import { useState } from 'hono/jsx'

export interface CommentFormProps {
  /** POST endpoint that creates a comment and returns `{ ok }` (403 if unread). */
  action: string
  authorName: string
  authorHandle: string
}

/**
 * Post a comment as a client island — avoids a full reload of the whole episode
 * page (body re-render) on submit. Appends the new comment in place and turns
 * the read-gate 403 into an inline message instead of an error page.
 */
export function CommentForm({ action, authorName, authorHandle }: CommentFormProps) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: Event) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new URLSearchParams({ body: text }),
      })
      if (res.status === 403) {
        setError('エピソードを最後まで読むとコメントできます')
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      prepend(text, authorName, authorHandle)
      setBody('')
    } catch {
      setError('コメントの投稿に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} class="mb-6 space-y-2">
      <textarea
        value={body}
        onInput={(e: Event) => setBody((e.currentTarget as HTMLTextAreaElement).value)}
        rows={3}
        required
        placeholder="読み終えた感想を書く"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {error ? <p class="text-xs text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        コメントする
      </button>
    </form>
  )
}

/**
 * Insert the new comment into the SSR comment list (created via textContent, so
 * user input is never interpreted as HTML), and bump the count.
 */
function prepend(body: string, name: string, handle: string) {
  const section = document.getElementById('comment-section')
  if (!section) return
  document.getElementById('comment-empty')?.remove()

  let ul = document.getElementById('comment-list')
  if (!ul) {
    ul = document.createElement('ul')
    ul.id = 'comment-list'
    ul.className = 'space-y-4'
    section.appendChild(ul)
  }

  const li = document.createElement('li')
  li.className = 'text-sm'
  const meta = document.createElement('div')
  meta.className = 'flex items-center gap-2 text-xs text-muted-foreground'
  const a = document.createElement('a')
  a.className = 'hover:text-primary'
  a.href = `/@${handle}`
  a.textContent = name
  meta.appendChild(a)
  const p = document.createElement('p')
  p.className = 'mt-1 whitespace-pre-wrap'
  p.textContent = body
  li.appendChild(meta)
  li.appendChild(p)
  ul.insertBefore(li, ul.firstChild)

  const count = document.getElementById('comment-count')
  if (count) count.textContent = String(ul.children.length)
}
