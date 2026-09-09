import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt)

// Format: scrypt$<salt-hex>$<hash-hex>
// Bewusst ohne externe Abhaengigkeit - node:crypto reicht dafuer voellig aus.
const KEYLEN = 64

export async function hashPassword(plain) {
  const salt = randomBytes(16)
  const hash = await scrypt(plain.normalize('NFKC'), salt, KEYLEN)
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex')
}

export async function verifyPassword(plain, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(plain.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
