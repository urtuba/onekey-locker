import { toBase64Url } from './encoding'
import { deriveKeys } from './keys'
import { buildUpdateMessage, MAX_VERSION, signUpdate, verifyUpdate } from './sign'

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
const fromHex = (s: string) => new Uint8Array(Buffer.from(s, 'hex'))

const SECRET = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
const BLOB_ID = 'ryWb43UISEZcQsMzqGrE_g'
const BLOB = new Uint8Array(Array.from({ length: 50 }, (_, i) => (i * 3) % 256))

// Computed outside this code base with node:crypto.
const MESSAGE =
  '6f6e656b65792d6c6f636b65722f7570646174652f7631727957623433554953455a6351734d7a714772455f670000000717e631fe39b368a61dca27aaec5cda43b4ec614e50e35c08bdb7d9846796965c89373ada12072b29e02910eec2d4df571867aafeb796ccd38c9394c96e32591b'
const SIGNATURE =
  '78845468da183ab7bc8b74f0355da115e19c0f49d6023c77531de87e483f18f795246ae28c14c7f269b3fda73f23c2f2439a2b6e1856b9fe638eb8713eb2b905'

describe('update message', () => {
  it('has the documented layout', () => {
    const message = buildUpdateMessage(BLOB_ID, 7, BLOB)
    expect(hex(message)).toBe(MESSAGE)
    expect(message).toHaveLength(23 + 22 + 4 + 64)
  })

  it('rejects bad ids and versions', () => {
    expect(() => buildUpdateMessage('short', 1, BLOB)).toThrow('Invalid blob id')
    expect(() => buildUpdateMessage(BLOB_ID, 0, BLOB)).toThrow('Invalid version')
    expect(() => buildUpdateMessage(BLOB_ID, 1.5, BLOB)).toThrow('Invalid version')
    expect(() => buildUpdateMessage(BLOB_ID, MAX_VERSION + 1, BLOB)).toThrow('Invalid version')
  })
})

describe('signUpdate / verifyUpdate', () => {
  const { writeKeyPair } = deriveKeys(SECRET)

  it('matches the fixed signature vector (Ed25519 is deterministic)', () => {
    expect(hex(signUpdate(BLOB_ID, 7, BLOB, writeKeyPair.secretKey))).toBe(SIGNATURE)
  })

  it('verifies a good signature', () => {
    const sig = signUpdate(BLOB_ID, 7, BLOB, writeKeyPair.secretKey)
    expect(verifyUpdate(BLOB_ID, 7, BLOB, sig, writeKeyPair.publicKey)).toBe(true)
  })

  it('rejects a changed blob, version or id', () => {
    const sig = signUpdate(BLOB_ID, 7, BLOB, writeKeyPair.secretKey)
    const other = BLOB.slice()
    other[0] ^= 1
    expect(verifyUpdate(BLOB_ID, 7, other, sig, writeKeyPair.publicKey)).toBe(false)
    expect(verifyUpdate(BLOB_ID, 8, BLOB, sig, writeKeyPair.publicKey)).toBe(false)
    expect(verifyUpdate('AAAAAAAAAAAAAAAAAAAAAA', 7, BLOB, sig, writeKeyPair.publicKey)).toBe(false)
  })

  it('rejects a signature from another secret', () => {
    const stranger = deriveKeys(new Uint8Array(32).fill(9)).writeKeyPair
    const sig = signUpdate(BLOB_ID, 7, BLOB, stranger.secretKey)
    expect(verifyUpdate(BLOB_ID, 7, BLOB, sig, writeKeyPair.publicKey)).toBe(false)
  })

  it('rejects a flipped signature bit', () => {
    const sig = signUpdate(BLOB_ID, 7, BLOB, writeKeyPair.secretKey)
    sig[10] ^= 1
    expect(verifyUpdate(BLOB_ID, 7, BLOB, sig, writeKeyPair.publicKey)).toBe(false)
  })

  it('returns false (does not throw) for malformed input', () => {
    expect(verifyUpdate(BLOB_ID, 7, BLOB, new Uint8Array(10), writeKeyPair.publicKey)).toBe(false)
    expect(verifyUpdate(BLOB_ID, 7, BLOB, new Uint8Array(64), new Uint8Array(5))).toBe(false)
    expect(verifyUpdate('bad', 7, BLOB, new Uint8Array(64), writeKeyPair.publicKey)).toBe(false)
    expect(verifyUpdate(BLOB_ID, -1, BLOB, new Uint8Array(64), writeKeyPair.publicKey)).toBe(false)
  })

  it('a signature does not reveal anything the server can turn into the read key', () => {
    // Structural: signing needs only the Ed25519 secret key; the server sees the signature and public key.
    const sig = signUpdate(BLOB_ID, 7, BLOB, writeKeyPair.secretKey)
    const { readKey } = deriveKeys(SECRET)
    expect(toBase64Url(sig)).not.toContain(toBase64Url(readKey))
    expect(hex(sig)).not.toContain(hex(readKey))
  })
})
