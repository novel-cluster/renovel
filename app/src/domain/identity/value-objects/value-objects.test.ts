import { describe, expect, it } from 'bun:test'
import { ValidationError } from '@/shared/errors/app-error'
import { Email } from './email'
import { Handle } from './handle'
import { RawPassword } from './password'

describe('Handle', () => {
  it('normalizes to lowercase and trims', () => {
    expect(Handle.create('  Alice_01 ').value).toBe('alice_01')
  })

  it('rejects too short, spaces, and invalid characters', () => {
    expect(() => Handle.create('ab')).toThrow(ValidationError)
    expect(() => Handle.create('has space')).toThrow(ValidationError)
    expect(() => Handle.create('bad-dash')).toThrow(ValidationError)
    expect(() => Handle.create('a'.repeat(31))).toThrow(ValidationError)
  })
})

describe('Email', () => {
  it('trims and lowercases', () => {
    expect(Email.create('  Foo@Example.COM ').value).toBe('foo@example.com')
  })

  it('rejects malformed addresses', () => {
    expect(() => Email.create('nope')).toThrow(ValidationError)
    expect(() => Email.create('a@b')).toThrow(ValidationError)
  })
})

describe('RawPassword', () => {
  it('requires at least 8 characters', () => {
    expect(() => RawPassword.create('short')).toThrow(ValidationError)
    expect(RawPassword.create('longenough').value).toBe('longenough')
  })
})
