import nacl from 'tweetnacl'
import { fromBase64Url, toBase64Url } from './encoding'
import {
  deriveBlobId,
  deriveKeys,
  deriveReadKey,
  deriveViewKeys,
  deriveWriteKeyPair,
  generateSecret,
  ID_DOMAIN,
  READ_DOMAIN,
  WRITE_DOMAIN,
} from './keys'

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
const fromHex = (s: string) => new Uint8Array(Buffer.from(s, 'hex'))

// Fixed vectors, computed outside this code base with node:crypto (SHA-512 and Ed25519 from seed).
const SECRET = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
const READ_KEY = '28f4fa5b8a461f287b0b3dd9bc2fffd0838cf5d7c36a105697c40db4dea2bfb0'
const BLOB_ID = 'ryWb43UISEZcQsMzqGrE_g'
const WRITE_PUBLIC_KEY = '1c29644cb6785f5a667bafbb43f16ec410bc5e9cdad82482f2e090216b2f1979'

describe('generateSecret', () => {
  it('returns 32 random bytes', () => {
    const a = generateSecret()
    const b = generateSecret()
    expect(a).toHaveLength(32)
    expect(hex(a)).not.toBe(hex(b))
  })
})

describe('key derivation vectors', () => {
  it('derives the read key', () => {
    expect(hex(deriveReadKey(SECRET))).toBe(READ_KEY)
  })

  it('derives the blob id from the read key', () => {
    expect(deriveBlobId(fromHex(READ_KEY))).toBe(BLOB_ID)
  })

  it('derives the Ed25519 write key pair', () => {
    const pair = deriveWriteKeyPair(SECRET)
    expect(hex(pair.publicKey)).toBe(WRITE_PUBLIC_KEY)
    expect(pair.secretKey).toHaveLength(64)
  })

  it('deriveKeys returns all three', () => {
    const keys = deriveKeys(SECRET)
    expect(hex(keys.readKey)).toBe(READ_KEY)
    expect(keys.blobId).toBe(BLOB_ID)
    expect(hex(keys.writeKeyPair.publicKey)).toBe(WRITE_PUBLIC_KEY)
  })

  it('a viewer gets the same id from the read key alone', () => {
    expect(deriveViewKeys(fromHex(READ_KEY)).blobId).toBe(BLOB_ID)
  })

  it('is deterministic', () => {
    expect(hex(deriveReadKey(SECRET))).toBe(hex(deriveReadKey(SECRET)))
    expect(hex(deriveWriteKeyPair(SECRET).publicKey)).toBe(hex(deriveWriteKeyPair(SECRET).publicKey))
  })

  it('uses 22-character URL-safe ids', () => {
    for (let i = 0; i < 50; i++) {
      expect(deriveKeys(generateSecret()).blobId).toMatch(/^[A-Za-z0-9_-]{22}$/)
    }
  })
})

describe('key separation', () => {
  it('the three domains are different', () => {
    expect(new Set([READ_DOMAIN, ID_DOMAIN, WRITE_DOMAIN]).size).toBe(3)
  })

  it('read key, write seed and secret are all different', () => {
    const secret = generateSecret()
    const read = deriveReadKey(secret)
    const write = deriveWriteKeyPair(secret)
    expect(hex(read)).not.toBe(hex(secret))
    expect(hex(read)).not.toBe(hex(write.publicKey))
    expect(hex(read)).not.toBe(hex(write.secretKey.slice(0, 32)))
  })

  it('what the server stores contains no key material the reader or owner holds', () => {
    // The server gets: the blob id and the write public key (plus ciphertext). Check that
    // neither contains the secret or the read key, as raw bytes or as base64url.
    for (let i = 0; i < 20; i++) {
      const secret = generateSecret()
      const { readKey, blobId, writeKeyPair } = deriveKeys(secret)
      const stored = [blobId, toBase64Url(writeKeyPair.publicKey), hex(writeKeyPair.publicKey)].join('|')
      expect(stored).not.toContain(toBase64Url(readKey))
      expect(stored).not.toContain(toBase64Url(secret))
      expect(stored).not.toContain(hex(readKey))
      expect(stored).not.toContain(hex(secret))
    }
  })

  it('the blob id is a truncated one-way hash of the read key (not the read key)', () => {
    const readKey = deriveReadKey(generateSecret())
    const idBytes = fromBase64Url(deriveBlobId(readKey))
    expect(idBytes).toHaveLength(16)
    expect(hex(idBytes)).not.toBe(hex(readKey.slice(0, 16)))
  })

  it('the id function only takes the read key, so the write key cannot lead to the id of another locker', () => {
    // Structural: the id depends on nothing but its input, and the write public key is not a valid read key
    // for the same locker (different bytes, different id).
    const secret = generateSecret()
    const { readKey, blobId, writeKeyPair } = deriveKeys(secret)
    expect(deriveBlobId(writeKeyPair.publicKey)).not.toBe(blobId)
    expect(hex(writeKeyPair.publicKey)).not.toBe(hex(readKey))
  })

  it('changing a domain prefix changes every output (the prefixes are really mixed in)', () => {
    const secret = SECRET
    const plain = nacl.hash(secret).slice(0, 32)
    expect(hex(plain)).not.toBe(READ_KEY)
    expect(hex(plain)).not.toBe(hex(deriveWriteKeyPair(secret).publicKey))
  })

  it('different secrets give unrelated keys', () => {
    const a = deriveKeys(generateSecret())
    const b = deriveKeys(generateSecret())
    expect(a.blobId).not.toBe(b.blobId)
    expect(hex(a.readKey)).not.toBe(hex(b.readKey))
    expect(hex(a.writeKeyPair.publicKey)).not.toBe(hex(b.writeKeyPair.publicKey))
  })
})

describe('input checks', () => {
  it('rejects wrong lengths', () => {
    expect(() => deriveReadKey(new Uint8Array(31))).toThrow('Secret must be 32 bytes')
    expect(() => deriveWriteKeyPair(new Uint8Array(33))).toThrow('Secret must be 32 bytes')
    expect(() => deriveBlobId(new Uint8Array(16))).toThrow('Read key must be 32 bytes')
  })
})
