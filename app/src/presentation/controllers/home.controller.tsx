import type { Context } from 'hono'
import { raw } from 'hono/html'
import { HomePage } from '@/presentation/views/home'

/** Renders the SSR home page. */
export function getHome(c: Context) {
  return c.html(
    <>
      {raw('<!DOCTYPE html>')}
      <HomePage />
    </>,
  )
}
