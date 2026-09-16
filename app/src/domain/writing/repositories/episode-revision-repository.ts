export interface NewRevision {
  episodeId: string
  editorId: string
  revisionNo: number
  title: string
  body: string
  charCount: number
  changeNote?: string | null
  restoredFromId?: string | null
}

export interface RevisionSummary {
  id: string
  revisionNo: number
  title: string
  charCount: number
  editorId: string
  createdAt: Date
}

/**
 * Append-only Episode revision history (writing-revision.md §2). Never updates
 * or deletes — restore appends a new revision.
 */
export interface EpisodeRevisionRepository {
  nextRevisionNo(episodeId: string): Promise<number>
  create(input: NewRevision): Promise<RevisionSummary>
  listByEpisode(episodeId: string): Promise<RevisionSummary[]>
}
