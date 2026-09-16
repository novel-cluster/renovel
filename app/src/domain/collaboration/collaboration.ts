export type CollaboratorRole = 'owner' | 'admin' | 'writer' | 'editor' | 'viewer'

export type NovelAction =
  | 'novel.delete'
  | 'novel.settings'
  | 'novel.fork_policy'
  | 'collaborator.manage'
  | 'episode.create'
  | 'episode.edit'
  | 'episode.publish'
  | 'revision.restore'
  | 'view.private'

/** Collaborator-role permission matrix (auth.md §3.1, §4.1). */
const MATRIX: Record<NovelAction, CollaboratorRole[]> = {
  'novel.delete': ['owner'],
  'novel.fork_policy': ['owner'],
  'novel.settings': ['owner', 'admin'],
  'collaborator.manage': ['owner', 'admin'],
  'episode.create': ['owner', 'admin', 'writer'],
  'episode.edit': ['owner', 'admin', 'writer', 'editor'],
  'episode.publish': ['owner', 'admin'],
  'revision.restore': ['owner', 'admin', 'writer'],
  'view.private': ['owner', 'admin', 'writer', 'editor', 'viewer'],
}

/** Pure authorization decision — no DB, no Hono. */
export function can(role: CollaboratorRole | null, action: NovelAction): boolean {
  return role ? MATRIX[action].includes(role) : false
}

export interface Collaborator {
  userId: string
  handle: string
  displayName: string
  role: CollaboratorRole
}

export interface CollaboratorRepository {
  /** The user's role on a novel, or null if not a collaborator. */
  roleFor(novelId: string, userId: string): Promise<CollaboratorRole | null>
  list(novelId: string): Promise<Collaborator[]>
  add(input: {
    novelId: string
    userId: string
    role: CollaboratorRole
    invitedBy: string
  }): Promise<void>
  remove(novelId: string, userId: string): Promise<void>
  setRole(novelId: string, userId: string, role: CollaboratorRole): Promise<void>
  /** Novel ids the user collaborates on (for the studio index). */
  novelIdsForUser(userId: string): Promise<string[]>
}

export interface PendingInvitation {
  id: string
  novelId: string
  novelTitle: string
  inviterName: string | null
  role: CollaboratorRole
}

export interface InvitationRepository {
  /** Upsert a pending invitation for (novel, invitee). */
  invite(input: {
    novelId: string
    inviteeId: string
    inviterId: string
    role: CollaboratorRole
  }): Promise<void>
  pendingForUser(userId: string): Promise<PendingInvitation[]>
  findPending(
    id: string,
  ): Promise<{ id: string; novelId: string; inviteeId: string; role: CollaboratorRole } | null>
  markResponded(id: string, status: 'accepted' | 'declined'): Promise<void>
}
