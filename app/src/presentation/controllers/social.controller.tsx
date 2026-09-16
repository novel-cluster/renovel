import type { Context } from 'hono'
import { container } from '@/presentation/container'
import type { AppEnv } from '@/presentation/env'

function backTo(c: Context<AppEnv>): string {
  const ref = c.req.header('referer')
  if (ref) {
    try {
      return new URL(ref).pathname + new URL(ref).hash
    } catch {}
  }
  return '/'
}

function actor(c: Context<AppEnv>): string | null {
  return c.get('user')?.id ?? null
}

export async function postLike(c: Context<AppEnv>) {
  const userId = actor(c)
  if (!userId) return c.redirect('/login')
  await container.toggleLikeService.execute({ userId, episodeId: c.req.param('episodeId') ?? '' })
  return c.redirect(backTo(c))
}

export async function postComment(c: Context<AppEnv>) {
  const userId = actor(c)
  if (!userId) return c.redirect('/login')
  const body = await c.req.parseBody()
  await container.postCommentService.execute({
    userId,
    episodeId: c.req.param('episodeId') ?? '',
    body: String(body.body ?? ''),
    parentId: typeof body.parentId === 'string' && body.parentId ? body.parentId : null,
  })
  return c.redirect(backTo(c))
}

export async function postStar(c: Context<AppEnv>) {
  const userId = actor(c)
  if (!userId) return c.redirect('/login')
  const body = await c.req.parseBody()
  await container.setStarService.execute({
    userId,
    novelId: c.req.param('novelId') ?? '',
    value: Number(body.value),
  })
  return c.redirect(backTo(c))
}

export async function postNovelFollow(c: Context<AppEnv>) {
  const userId = actor(c)
  if (!userId) return c.redirect('/login')
  await container.toggleNovelFollowService.execute({
    userId,
    novelId: c.req.param('novelId') ?? '',
  })
  return c.redirect(backTo(c))
}

export async function postReview(c: Context<AppEnv>) {
  const userId = actor(c)
  if (!userId) return c.redirect('/login')
  const body = await c.req.parseBody()
  await container.upsertReviewService.execute({
    userId,
    novelId: c.req.param('novelId') ?? '',
    stars: Number(body.stars),
    title: String(body.title ?? ''),
    body: String(body.body ?? ''),
  })
  return c.redirect(backTo(c))
}

export async function postUserFollow(c: Context<AppEnv>) {
  const followerId = actor(c)
  if (!followerId) return c.redirect('/login')
  await container.toggleUserFollowService.execute({
    followerId,
    followeeId: c.req.param('userId') ?? '',
  })
  return c.redirect(backTo(c))
}
