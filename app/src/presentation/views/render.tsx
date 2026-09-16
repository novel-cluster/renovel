import type { Context } from 'hono'
import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Renders a full HTML document (DOCTYPE + page) with an optional status code. */
export function renderPage(c: Context, node: Child, status: ContentfulStatusCode = 200) {
  return c.html(
    <>
      {raw('<!DOCTYPE html>')}
      {node}
    </>,
    status,
  )
}
