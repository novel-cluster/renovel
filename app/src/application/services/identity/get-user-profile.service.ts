import type { User } from '@/domain/identity/entities/user'
import type { UserRepository } from '@/domain/identity/repositories/user-repository'
import { NotFoundError } from '@/shared/errors/app-error'

/** Public profile lookup for `/@{handle}` (routing.md §3.1). 404 if not found. */
export class GetUserProfileService {
  constructor(private readonly users: UserRepository) {}

  async execute(handle: string): Promise<User> {
    const user = await this.users.findByHandle(handle.trim().toLowerCase())
    if (!user) {
      throw new NotFoundError('ユーザーが見つかりません')
    }
    return user
  }
}
