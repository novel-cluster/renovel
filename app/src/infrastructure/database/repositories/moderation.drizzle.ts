import { and, desc, eq } from 'drizzle-orm'
import type {
  ModerationRepository,
  ReportStatus,
  ReportTargetType,
  ReportView,
  UserStatus,
} from '@/domain/moderation/moderation'
import { db } from '@/infrastructure/database/drizzle/client'
import {
  blocks,
  comments,
  episodes,
  mutes,
  novels,
  reports,
  reviews,
  users,
} from '@/infrastructure/database/schema'

export class DrizzleModerationRepository implements ModerationRepository {
  async createReport(input: {
    reporterId: string
    targetType: ReportTargetType
    targetId: string
    reason: string
  }): Promise<void> {
    await db.insert(reports).values({
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
    })
  }

  async listReports(status: ReportStatus | 'all'): Promise<ReportView[]> {
    const base = db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        status: reports.status,
        reporterName: users.displayName,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .leftJoin(users, eq(reports.reporterId, users.id))
      .$dynamic()
    const rows = await (status === 'all' ? base : base.where(eq(reports.status, status))).orderBy(
      desc(reports.createdAt),
    )
    return rows
  }

  async resolveReport(
    id: string,
    resolverId: string,
    status: 'resolved' | 'dismissed',
  ): Promise<void> {
    await db
      .update(reports)
      .set({ status, resolvedBy: resolverId, resolvedAt: new Date() })
      .where(eq(reports.id, id))
  }

  async hideNovel(novelId: string): Promise<void> {
    await db
      .update(novels)
      .set({ contentState: 'hidden', updatedAt: new Date() })
      .where(eq(novels.id, novelId))
  }

  async hideEpisode(episodeId: string): Promise<void> {
    await db
      .update(episodes)
      .set({ contentState: 'hidden', updatedAt: new Date() })
      .where(eq(episodes.id, episodeId))
  }

  async deleteComment(commentId: string): Promise<void> {
    await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId))
  }

  async deleteReview(reviewId: string): Promise<void> {
    await db.update(reviews).set({ deletedAt: new Date() }).where(eq(reviews.id, reviewId))
  }

  async setUserStatus(userId: string, status: UserStatus): Promise<void> {
    await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId))
  }

  async toggleBlock(blockerId: string, blockedId: string): Promise<{ blocked: boolean }> {
    const [existing] = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
      .limit(1)
    if (existing) {
      await db.delete(blocks).where(eq(blocks.id, existing.id))
      return { blocked: false }
    }
    await db.insert(blocks).values({ blockerId, blockedId })
    return { blocked: true }
  }

  async toggleMute(muterId: string, mutedId: string): Promise<{ muted: boolean }> {
    const [existing] = await db
      .select({ id: mutes.id })
      .from(mutes)
      .where(and(eq(mutes.muterId, muterId), eq(mutes.mutedId, mutedId)))
      .limit(1)
    if (existing) {
      await db.delete(mutes).where(eq(mutes.id, existing.id))
      return { muted: false }
    }
    await db.insert(mutes).values({ muterId, mutedId })
    return { muted: true }
  }
}
