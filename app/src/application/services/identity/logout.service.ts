import type { SessionRepository } from '@/domain/identity/repositories/session-repository'
import { hashToken } from '@/shared/utils/token'

/** Ends a session by deleting its row (auth.md §1.4). No-op for guests. */
export class LogoutService {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(sessionToken: string | null): Promise<void> {
    if (!sessionToken) return
    await this.sessions.deleteByTokenHash(hashToken(sessionToken))
  }
}
