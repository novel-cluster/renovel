import { describe, expect, it } from 'bun:test'
import { ForbiddenError, UnauthorizedError } from '@/shared/errors/app-error'
import { FakeHasher, FakeSessionRepository, FakeUserRepository } from './_fakes'
import { LoginService } from './login.service'

function setup() {
  const users = new FakeUserRepository()
  const sessions = new FakeSessionRepository()
  const hasher = new FakeHasher()
  const service = new LoginService(users, sessions, hasher)
  return { users, sessions, hasher, service }
}

describe('LoginService', () => {
  it('issues a session for correct credentials', async () => {
    const { users, sessions, service } = setup()
    users.seed({ handle: 'alice', email: 'alice@example.com', passwordHash: 'hashed:password1' })

    const result = await service.execute({ email: 'Alice@example.com', password: 'password1' })

    expect(sessions.created).toHaveLength(1)
    expect(result.sessionToken).toBeTruthy()
  })

  it('rejects a wrong password', async () => {
    const { users, service } = setup()
    users.seed({ handle: 'alice', email: 'alice@example.com', passwordHash: 'hashed:password1' })
    await expect(
      service.execute({ email: 'alice@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects an unknown email but still runs a verify (timing-safe)', async () => {
    const { hasher, service } = setup()
    await expect(
      service.execute({ email: 'ghost@example.com', password: 'whatever1' }),
    ).rejects.toBeInstanceOf(UnauthorizedError)
    expect(hasher.verifyCalls).toBe(1)
  })

  it('rejects a banned account', async () => {
    const { users, service } = setup()
    users.seed({
      handle: 'alice',
      email: 'alice@example.com',
      passwordHash: 'hashed:password1',
      status: 'banned',
    })
    await expect(
      service.execute({ email: 'alice@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})
