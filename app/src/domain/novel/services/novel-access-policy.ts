import type { EpisodeStatus } from '../entities/episode'
import type { ContentState, Visibility } from '../entities/novel'

/**
 * Read-access policy (auth.md §3.2). Pure decision logic — no DB, no Hono. The
 * caller supplies the already-fetched visibility/state and whether the viewer is
 * an owner/collaborator.
 *
 * In Phase 2 "owner" means the Novel author; Collaborator roles arrive in
 * Phase 7 and extend the `isOwner` input.
 */

const RANK: Record<Visibility, number> = { public: 0, unlisted: 1, private: 2 }

/** An Episode may only narrow, never widen, its Novel's visibility. */
export function effectiveVisibility(
  novelVisibility: Visibility,
  episodeVisibility: Visibility | null,
): Visibility {
  if (episodeVisibility === null) return novelVisibility
  return RANK[episodeVisibility] >= RANK[novelVisibility] ? episodeVisibility : novelVisibility
}

export interface NovelAccess {
  visibility: Visibility
  contentState: ContentState
  isOwner: boolean
}

/** Can the viewer reach the Novel page? (Unlisted is reachable by direct URL.) */
export function canViewNovel(a: NovelAccess): boolean {
  if (a.isOwner) return true
  if (a.contentState === 'hidden') return false
  return a.visibility === 'public' || a.visibility === 'unlisted'
}

export interface EpisodeAccess {
  novelVisibility: Visibility
  novelContentState: ContentState
  episodeStatus: EpisodeStatus
  episodeVisibility: Visibility | null
  episodeContentState: ContentState
  isOwner: boolean
}

/** Can the viewer read the Episode? Drafts and hidden content are owner-only. */
export function canViewEpisode(a: EpisodeAccess): boolean {
  if (a.isOwner) return true
  if (a.novelContentState === 'hidden' || a.episodeContentState === 'hidden') return false
  if (a.episodeStatus === 'draft') return false
  const eff = effectiveVisibility(a.novelVisibility, a.episodeVisibility)
  return eff === 'public' || eff === 'unlisted'
}
