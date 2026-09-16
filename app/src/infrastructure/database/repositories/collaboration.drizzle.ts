import { and, eq } from 'drizzle-orm'
import type {
  Collaborator,
  CollaboratorRepository,
  CollaboratorRole,
  InvitationRepository,
  PendingInvitation,
} from '@/domain/collaboration/collaboration'
import { db } from '@/infrastructure/database/drizzle/client'
import {
  collaborationInvitations,
  collaborators,
  novels,
  users,
} from '@/infrastructure/database/schema'

export class DrizzleCollaboratorRepository implements CollaboratorRepository {
  async roleFor(novelId: string, userId: string): Promise<CollaboratorRole | null> {
    const [row] = await db
      .select({ role: collaborators.role })
      .from(collaborators)
      .where(and(eq(collaborators.novelId, novelId), eq(collaborators.userId, userId)))
      .limit(1)
    return row?.role ?? null
  }

  async list(novelId: string): Promise<Collaborator[]> {
    return db
      .select({
        userId: collaborators.userId,
        handle: users.handle,
        displayName: users.displayName,
        role: collaborators.role,
      })
      .from(collaborators)
      .innerJoin(users, eq(collaborators.userId, users.id))
      .where(eq(collaborators.novelId, novelId))
  }

  async add(input: {
    novelId: string
    userId: string
    role: CollaboratorRole
    invitedBy: string
  }): Promise<void> {
    await db
      .insert(collaborators)
      .values({
        novelId: input.novelId,
        userId: input.userId,
        role: input.role,
        invitedBy: input.invitedBy,
      })
      .onConflictDoUpdate({
        target: [collaborators.novelId, collaborators.userId],
        set: { role: input.role },
      })
  }

  async remove(novelId: string, userId: string): Promise<void> {
    await db
      .delete(collaborators)
      .where(and(eq(collaborators.novelId, novelId), eq(collaborators.userId, userId)))
  }

  async setRole(novelId: string, userId: string, role: CollaboratorRole): Promise<void> {
    await db
      .update(collaborators)
      .set({ role })
      .where(and(eq(collaborators.novelId, novelId), eq(collaborators.userId, userId)))
  }

  async novelIdsForUser(userId: string): Promise<string[]> {
    const rows = await db
      .select({ novelId: collaborators.novelId })
      .from(collaborators)
      .where(eq(collaborators.userId, userId))
    return rows.map((r) => r.novelId)
  }
}

export class DrizzleInvitationRepository implements InvitationRepository {
  async invite(input: {
    novelId: string
    inviteeId: string
    inviterId: string
    role: CollaboratorRole
  }): Promise<void> {
    const [existing] = await db
      .select({ id: collaborationInvitations.id })
      .from(collaborationInvitations)
      .where(
        and(
          eq(collaborationInvitations.novelId, input.novelId),
          eq(collaborationInvitations.inviteeId, input.inviteeId),
          eq(collaborationInvitations.status, 'pending'),
        ),
      )
      .limit(1)
    if (existing) {
      await db
        .update(collaborationInvitations)
        .set({ role: input.role, inviterId: input.inviterId })
        .where(eq(collaborationInvitations.id, existing.id))
      return
    }
    await db.insert(collaborationInvitations).values({
      novelId: input.novelId,
      inviteeId: input.inviteeId,
      inviterId: input.inviterId,
      role: input.role,
    })
  }

  async pendingForUser(userId: string): Promise<PendingInvitation[]> {
    return db
      .select({
        id: collaborationInvitations.id,
        novelId: collaborationInvitations.novelId,
        novelTitle: novels.title,
        inviterName: users.displayName,
        role: collaborationInvitations.role,
      })
      .from(collaborationInvitations)
      .innerJoin(novels, eq(collaborationInvitations.novelId, novels.id))
      .leftJoin(users, eq(collaborationInvitations.inviterId, users.id))
      .where(
        and(
          eq(collaborationInvitations.inviteeId, userId),
          eq(collaborationInvitations.status, 'pending'),
        ),
      )
  }

  async findPending(id: string) {
    const [row] = await db
      .select({
        id: collaborationInvitations.id,
        novelId: collaborationInvitations.novelId,
        inviteeId: collaborationInvitations.inviteeId,
        role: collaborationInvitations.role,
      })
      .from(collaborationInvitations)
      .where(
        and(eq(collaborationInvitations.id, id), eq(collaborationInvitations.status, 'pending')),
      )
      .limit(1)
    return row ?? null
  }

  async markResponded(id: string, status: 'accepted' | 'declined'): Promise<void> {
    await db
      .update(collaborationInvitations)
      .set({ status, respondedAt: new Date() })
      .where(eq(collaborationInvitations.id, id))
  }
}
