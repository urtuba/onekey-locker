import { toBase64Url } from './encoding'
import { deriveBlobId, deriveKeyHash, derivePublicKey, generateKeyPair, verifyKey } from './keys'

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

describe('deriveBlobId', () => {
  it('derives 16-byte blob ID', () => {
    const { publicKey } = generateKeyPair()
    const blobId = deriveBlobId(publicKey)
    expect(blobId).toHaveLength(16)
  })

  it('produces 22-char base64url ID', () => {
    const { publicKey } = generateKeyPair()
    const blobId = deriveBlobId(publicKey)
    const encoded = toBase64Url(blobId)
    expect(encoded).toHaveLength(22)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('is deterministic', () => {
    const publicKey = new Uint8Array(32).fill(42)
    const id1 = deriveBlobId(publicKey)
    const id2 = deriveBlobId(publicKey)
    expect(toBase64Url(id1)).toBe(toBase64Url(id2))
  })

  it('throws on invalid key length', () => {
    expect(() => deriveBlobId(new Uint8Array(16))).toThrow('Public key must be 32 bytes')
  })
})

describe('deriveKeyHash from public key', () => {
  it('derives 32-byte hash', () => {
    const { publicKey } = generateKeyPair()
    const hash = deriveKeyHash(publicKey)
    expect(hash).toHaveLength(32)
  })

  it('is deterministic', () => {
    const publicKey = new Uint8Array(32).fill(99)
    const hash1 = deriveKeyHash(publicKey)
    const hash2 = deriveKeyHash(publicKey)
    expect(toBase64Url(hash1)).toBe(toBase64Url(hash2))
  })

  it('throws on invalid key length', () => {
    expect(() => deriveKeyHash(new Uint8Array(10))).toThrow('Key must be 32 bytes')
  })
})

describe('verifyKey from public key', () => {
  it('verifies correct public key', () => {
    const { publicKey } = generateKeyPair()
    const hash = deriveKeyHash(publicKey)
    expect(verifyKey(publicKey, hash)).toBe(true)
  })

  it('rejects wrong public key', () => {
    const { publicKey } = generateKeyPair()
    const hash = deriveKeyHash(publicKey)
    const wrongKey = new Uint8Array(32).fill(1)
    expect(verifyKey(wrongKey, hash)).toBe(false)
  })

  it('handles length mismatch', () => {
    const publicKey = new Uint8Array(32)
    const wrongHash = new Uint8Array(16)
    expect(verifyKey(publicKey, wrongHash)).toBe(false)
  })
})

describe('deriveKeyHash from private key', () => {
  it('derives 32-byte hash', () => {
    const { privateKey } = generateKeyPair()
    const hash = deriveKeyHash(privateKey)
    expect(hash).toHaveLength(32)
  })

  it('is deterministic', () => {
    const privateKey = new Uint8Array(32).fill(99)
    const hash1 = deriveKeyHash(privateKey)
    const hash2 = deriveKeyHash(privateKey)
    expect(toBase64Url(hash1)).toBe(toBase64Url(hash2))
  })

  it('throws on invalid key length', () => {
    expect(() => deriveKeyHash(new Uint8Array(10))).toThrow('Key must be 32 bytes')
  })
})

describe('verifyKey from private key', () => {
  it('verifies correct private key', () => {
    const { privateKey } = generateKeyPair()
    const hash = deriveKeyHash(privateKey)
    expect(verifyKey(privateKey, hash)).toBe(true)
  })

  it('rejects wrong private key', () => {
    const { privateKey } = generateKeyPair()
    const hash = deriveKeyHash(privateKey)
    const wrongKey = new Uint8Array(32).fill(1)
    expect(verifyKey(wrongKey, hash)).toBe(false)
  })

  it('handles length mismatch', () => {
    const privateKey = new Uint8Array(32)
    const wrongHash = new Uint8Array(16)
    expect(verifyKey(privateKey, wrongHash)).toBe(false)
  })
})
