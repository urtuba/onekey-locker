import { toBase64Url } from './encoding' 
import { derivePublicKey, generateKeyPair } from './keys'

describe('generateKeyPair', () => {
  it('generates 32-byte keys', () => {
    const { privateKey, publicKey } = generateKeyPair()
    expect(privateKey).toHaveLength(32)
    expect(publicKey).toHaveLength(32)
  })

  it('generates different keys each time', () => {
    const pair1 = generateKeyPair()
    const pair2 = generateKeyPair()
    expect(toBase64Url(pair1.privateKey)).not.toBe(toBase64Url(pair2.privateKey))
    expect(toBase64Url(pair1.publicKey)).not.toBe(toBase64Url(pair2.publicKey))
  })

  it('mixes seed with random bytes', () => {
    const seed = new Uint8Array(32).fill(42)
    const pair1 = generateKeyPair(seed)
    const pair2 = generateKeyPair(seed)
    // Should NOT be deterministic (seed adds entropy, not replaces it)
    expect(toBase64Url(pair1.privateKey)).not.toBe(toBase64Url(pair2.privateKey))
  })

  it('produces URL-safe base64 public keys', () => {
    const { publicKey } = generateKeyPair()
    const encoded = toBase64Url(publicKey)
    expect(encoded).toHaveLength(43)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('derivePublicKey', () => {
  it('derives same public key from private key', () => {
    const { privateKey, publicKey } = generateKeyPair()
    const derived = derivePublicKey(privateKey)
    expect(toBase64Url(derived)).toBe(toBase64Url(publicKey))
  })

  it('throws on invalid private key length', () => {
    expect(() => derivePublicKey(new Uint8Array(16))).toThrow('Private key must be 32 bytes')
  })

  it('is deterministic', () => {
    const privateKey = new Uint8Array(32).fill(123)
    const pub1 = derivePublicKey(privateKey)
    const pub2 = derivePublicKey(privateKey)
    expect(toBase64Url(pub1)).toBe(toBase64Url(pub2))
  })
})