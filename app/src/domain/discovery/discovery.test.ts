import { describe, expect, it } from 'bun:test'
import { rankingScore } from './discovery'

const now = new Date('2026-09-16T00:00:00Z')
const base = { likeCount: 0, starCount: 0, starAvg: 0, followCount: 0, publishedAt: now }

describe('rankingScore', () => {
  it('weights stars and follows above likes', () => {
    const likes = rankingScore({ ...base, likeCount: 10 }, now)
    const follows = rankingScore({ ...base, followCount: 10 }, now)
    expect(follows).toBeGreaterThan(likes)
  })

  it('decays with age', () => {
    const fresh = rankingScore({ ...base, likeCount: 100, publishedAt: now }, now)
    const old = rankingScore(
      { ...base, likeCount: 100, publishedAt: new Date('2026-06-01T00:00:00Z') },
      now,
    )
    expect(fresh).toBeGreaterThan(old)
  })

  it('handles never-published novels without throwing', () => {
    expect(rankingScore({ ...base, likeCount: 5, publishedAt: null }, now)).toBeGreaterThan(0)
  })
})
