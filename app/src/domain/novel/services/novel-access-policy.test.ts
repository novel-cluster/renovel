import { describe, expect, it } from 'bun:test'
import { canViewEpisode, canViewNovel, effectiveVisibility } from './novel-access-policy'

describe('effectiveVisibility', () => {
  it('inherits the novel visibility when episode is null', () => {
    expect(effectiveVisibility('public', null)).toBe('public')
  })
  it('narrows to the more restrictive and never widens', () => {
    expect(effectiveVisibility('public', 'private')).toBe('private')
    expect(effectiveVisibility('private', 'public')).toBe('private')
    expect(effectiveVisibility('unlisted', 'public')).toBe('unlisted')
  })
})

describe('canViewNovel', () => {
  it('owner can always view', () => {
    expect(canViewNovel({ visibility: 'private', contentState: 'visible', isOwner: true })).toBe(
      true,
    )
  })
  it('public and unlisted are viewable by anyone', () => {
    expect(canViewNovel({ visibility: 'public', contentState: 'visible', isOwner: false })).toBe(
      true,
    )
    expect(canViewNovel({ visibility: 'unlisted', contentState: 'visible', isOwner: false })).toBe(
      true,
    )
  })
  it('private and hidden are not viewable by non-owners', () => {
    expect(canViewNovel({ visibility: 'private', contentState: 'visible', isOwner: false })).toBe(
      false,
    )
    expect(canViewNovel({ visibility: 'public', contentState: 'hidden', isOwner: false })).toBe(
      false,
    )
  })
})

describe('canViewEpisode', () => {
  const base = {
    novelVisibility: 'public',
    novelContentState: 'visible',
    episodeVisibility: null,
    episodeContentState: 'visible',
  } as const

  it('drafts are owner-only', () => {
    expect(canViewEpisode({ ...base, episodeStatus: 'draft', isOwner: false })).toBe(false)
    expect(canViewEpisode({ ...base, episodeStatus: 'draft', isOwner: true })).toBe(true)
  })
  it('published + public + visible is public', () => {
    expect(canViewEpisode({ ...base, episodeStatus: 'published', isOwner: false })).toBe(true)
  })
  it('a private novel hides its published episodes from non-owners', () => {
    expect(
      canViewEpisode({
        ...base,
        novelVisibility: 'private',
        episodeStatus: 'published',
        isOwner: false,
      }),
    ).toBe(false)
  })
})
