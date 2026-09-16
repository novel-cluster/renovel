import { createHash, randomBytes } from 'node:crypto'

/**
 * Opaque session tokens (auth.md §1.4). The raw token is put in the cookie; only
 * its SHA-256 hash is stored in `sessions.token_hash`, so a DB leak does not
 * expose usable session tokens.
 */

/** 256-bit URL-safe random token handed to the client via cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 of a raw token — what we persist and look sessions up by. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
