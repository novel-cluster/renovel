import { describe, expect, it } from 'bun:test'
import { ConflictError, ValidationError } from '@/shared/errors/app-error'
import { hashToken } from '@/shared/utils/token'
import { FakeHasher, FakeSessionRepository, FakeUserRepository } from './_fakes'
import { SignupService } from './signup.service'

function setup() {
  const users = new FakeUserRepository()
  const sessions = new FakeSessionRepository()
  const service = new SignupService(users, sessions, new FakeHasher())
  return { users, sessions, service }
}

const input = {
  handle: 'Alice',
  displayName: 'Alice',
  email: 'Alice@Example.com',
  password: 'password1',
}

describe('SignupService', () => {
  it('creates a normalized user and issues a session', async () => {
    const { users, sessions, service } = setup()
    const result = await service.execute(input)

    expect(result.user.handle).toBe('alice')
    expect(result.user.email).toBe('alice@example.com')
    expect(users.users[0].passwordHash).toBe('hashed:password1')
    // The DB stores only the hash of the returned raw token.
    expect(sessions.created[0].tokenHash).toBe(hashToken(result.sessionToken))
    expect(sessions.created[0].userId).toBe(result.user.id)
  })

  it('rejects a duplicate handle', async () => {
    const { service } = setup()
    await service.execute(input)
    await expect(service.execute({ ...input, email: 'other@example.com' })).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('rejects a duplicate email', async () => {
    const { service } = setup()
    await service.execute(input)
    await expect(service.execute({ ...input, handle: 'bob' })).rejects.toBeInstanceOf(ConflictError)
  })

  it('rejects an invalid handle before touching the repository', async () => {
    const { service } = setup()
    await expect(service.execute({ ...input, handle: 'no' })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})
