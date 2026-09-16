import type { Context } from 'hono'
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from '@/presentation/auth/session-cookie'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'
import { LoginPage } from '@/presentation/views/auth/login'
import { SignupPage } from '@/presentation/views/auth/signup'
import { renderPage } from '@/presentation/views/render'
import { AppError } from '@/shared/errors/app-error'

/** First value of `X-Forwarded-For` (Cloudflare/proxy), for the session audit column. */
function clientIp(c: Context): string | null {
  const xff = c.req.header('x-forwarded-for')
  return xff ? (xff.split(',')[0]?.trim() ?? null) : null
}

/** Only allow same-site relative redirects (no `//host` protocol-relative). */
function safeRedirect(target: unknown): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/'
}

export function getLogin(c: Context<AppEnv>) {
  if (c.get('user')) return c.redirect('/')
  return renderPage(c, <LoginPage redirect={c.req.query('redirect')} />)
}

export async function postLogin(c: Context<AppEnv>) {
  const body = await c.req.parseBody()
  const email = String(body.email ?? '')
  const redirect = safeRedirect(body.redirect)
  try {
    const result = await container.loginService.execute({
      email,
      password: String(body.password ?? ''),
      ip: clientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    })
    setSessionCookie(c, result.sessionToken, result.expiresAt)
    return c.redirect(redirect)
  } catch (err) {
    if (err instanceof AppError) {
      return renderPage(
        c,
        <LoginPage
          error={err.message}
          email={email}
          redirect={redirect === '/' ? undefined : redirect}
        />,
        err.status,
      )
    }
    throw err
  }
}

export function getSignup(c: Context<AppEnv>) {
  if (c.get('user')) return c.redirect('/')
  return renderPage(c, <SignupPage />)
}

export async function postSignup(c: Context<AppEnv>) {
  const body = await c.req.parseBody()
  const handle = String(body.handle ?? '')
  const displayName = String(body.displayName ?? '')
  const email = String(body.email ?? '')
  try {
    const result = await container.signupService.execute({
      handle,
      displayName,
      email,
      password: String(body.password ?? ''),
      ip: clientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    })
    setSessionCookie(c, result.sessionToken, result.expiresAt)
    return c.redirect(`/@${result.user.handle}`)
  } catch (err) {
    if (err instanceof AppError) {
      return renderPage(
        c,
        <SignupPage error={err.message} handle={handle} displayName={displayName} email={email} />,
        err.status,
      )
    }
    throw err
  }
}

export async function postLogout(c: Context<AppEnv>) {
  await container.logoutService.execute(getSessionToken(c))
  clearSessionCookie(c)
  return c.redirect('/')
}
