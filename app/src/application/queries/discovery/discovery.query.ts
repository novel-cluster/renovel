import type {
  DiscoveryRepository,
  NovelCard,
  RankingParams,
  SearchParams,
} from '@/domain/discovery/discovery'
import { rankingScore } from '@/domain/discovery/discovery'

/** Search novels (public only) with filters/sort (PRD §23–25). */
export class SearchNovelsQuery {
  constructor(private readonly discovery: DiscoveryRepository) {}

  execute(params: SearchParams): Promise<NovelCard[]> {
    return this.discovery.search(params)
  }
}

/** Ranking: fetch candidates in a window, sort by the pure score (PRD §26). */
export class RankingQuery {
  constructor(private readonly discovery: DiscoveryRepository) {}

  async execute(params: RankingParams): Promise<NovelCard[]> {
    const candidates = await this.discovery.rankingCandidates(params)
    const now = new Date()
    return candidates
      .map((card) => ({ card, score: rankingScore(card, now) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit)
      .map((x) => x.card)
  }
}

export interface HomeView {
  ranking: NovelCard[]
  newest: NovelCard[]
  recommended: NovelCard[]
}

/** Home page blocks, split into cacheable and personalized (discovery.md §6). */
export class HomeQuery {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly ranking: RankingQuery,
  ) {}

  async execute(viewerId: string | null): Promise<HomeView> {
    const [ranking, newest] = await Promise.all([
      this.ranking.execute({ window: 'week', limit: 6 }),
      this.discovery.newest(6),
    ])
    const recommended = viewerId ? await this.discovery.popular(viewerId, 6) : []
    return { ranking, newest, recommended }
  }
}
