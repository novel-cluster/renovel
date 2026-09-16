/** Attribution back to the source work (PRD §14 — never removable). */
export interface ForkAttribution {
  sourceNovelId: string
  sourceSlug: string
  sourceTitle: string
  sourceAuthorHandle: string
  sourceAuthorName: string
}

export interface ForkRepository {
  create(input: {
    sourceNovelId: string
    forkedNovelId: string
    forkedBy: string
    rootNovelId: string
  }): Promise<void>
  /** Attribution for a forked novel, or null if it is not a fork. */
  attributionFor(novelId: string): Promise<ForkAttribution | null>
}
