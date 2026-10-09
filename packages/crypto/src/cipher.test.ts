import type { Payload } from './cipher'
import { canDecrypt, decrypt, encrypt, getBlobSize, MAX_BLOB_BYTES, MIN_BLOB_BYTES } from './cipher'
import { deriveReadKey, generateSecret } from './keys'

describe('encrypt/decrypt', () => {
  const correctKey = new Uint8Array(32).fill(1)
  const wrongKey = new Uint8Array(32).fill(2)

  const payload: Payload = {
    v: 1,
    t: Date.now(),
    u: Date.now(),
    type: 'text',
    data: { content: 'secret message' },
  }

  it('encrypts and decrypts successfully', () => {
    const blob = encrypt(payload, correctKey)
    const decrypted = decrypt(blob, correctKey)
    expect(decrypted).toEqual(payload)
  })

  it('produces different ciphertext each time (random nonce)', () => {
    const blob1 = encrypt(payload, correctKey)
    const blob2 = encrypt(payload, correctKey)
    expect(blob1).not.toEqual(blob2)
  })

  it('fails with wrong key', () => {
    const blob = encrypt(payload, correctKey)
    expect(() => decrypt(blob, wrongKey)).toThrow('Decryption failed')
  })

  it('includes version byte', () => {
    const blob = encrypt(payload, correctKey)
    expect(blob[0]).toBe(1)
  })

  it('has correct wire format', () => {
    const blob = encrypt(payload, correctKey)
    expect(blob.length).toBeGreaterThan(25) // version + nonce + ciphertext
  })

  it('rejects invalid key length', () => {
    expect(() => encrypt(payload, new Uint8Array(16))).toThrow('Key must be 32 bytes')
    expect(() => decrypt(new Uint8Array(100), new Uint8Array(16))).toThrow('Key must be 32 bytes')
  })

  it('rejects blob too short', () => {
    expect(() => decrypt(new Uint8Array(10), correctKey)).toThrow('Blob too short')
  })

  it('rejects unsupported version', () => {
    const blob = encrypt(payload, correctKey)
    blob[0] = 99
    expect(() => decrypt(blob, correctKey)).toThrow('Unsupported version: 99')
  })

  it('handles all payload types', () => {
    const payloads: Payload[] = [
      { v: 1, t: 1, u: 1, type: 'text', data: { content: 'text' } },
      { v: 1, t: 1, u: 1, type: 'kv', data: { entries: [{ k: 'key', v: 'val' }] } },
      { v: 1, t: 1, u: 1, type: 'json', data: { content: { nested: { obj: 123 } } } },
    ]

    for (const p of payloads) {
      const blob = encrypt(p, correctKey)
      expect(decrypt(blob, correctKey)).toEqual(p)
    }
  })

  it('preserves unicode and special characters', () => {
    const unicodePayload: Payload = {
      v: 1,
      t: 1,
      u: 1,
      type: 'text',
      data: { content: '你好 🔐 émoji' },
    }
    const blob = encrypt(unicodePayload, correctKey)
    expect(decrypt(blob, correctKey)).toEqual(unicodePayload)
  })
})

describe('getBlobSize', () => {
  it('returns blob length', () => {
    const correctKey = new Uint8Array(32).fill(1)
    const payload: Payload = { v: 1, t: 1, u: 1, type: 'text', data: { content: 'test' } }
    const blob = encrypt(payload, correctKey)
    expect(getBlobSize(blob)).toBe(blob.length)
  })
})

describe('canDecrypt', () => {
  const correctKey = new Uint8Array(32).fill(1)
  const wrongKey = new Uint8Array(32).fill(2)

  it('returns true for correct key', () => {
    const payload: Payload = { v: 1, t: 1, u: 1, type: 'text', data: { content: 'test' } }
    const blob = encrypt(payload, correctKey)
    expect(canDecrypt(blob, correctKey)).toBe(true)
  })

  it('returns false for wrong key', () => {
    const payload: Payload = { v: 1, t: 1, u: 1, type: 'text', data: { content: 'test' } }
    const blob = encrypt(payload, correctKey)
    expect(canDecrypt(blob, wrongKey)).toBe(false)
  })

  it('returns false for corrupted blob', () => {
    const blob = new Uint8Array(100)
    expect(canDecrypt(blob, correctKey)).toBe(false)
  })
})

describe('blob limits and payload checks', () => {
  const key = deriveReadKey(generateSecret())

  it('MIN_BLOB_BYTES is version + nonce + MAC', () => {
    expect(MIN_BLOB_BYTES).toBe(41)
    expect(MAX_BLOB_BYTES).toBe(16384)
  })

  it('every real blob is at least the minimum size', () => {
    const blob = encrypt({ v: 1, t: 1, u: 1, type: 'text', data: { content: '' } }, key)
    expect(blob.length).toBeGreaterThanOrEqual(MIN_BLOB_BYTES)
  })

  it('refuses to encrypt a blob larger than the limit', () => {
    const big: Payload = { v: 1, t: 1, u: 1, type: 'text', data: { content: 'x'.repeat(MAX_BLOB_BYTES) } }
    expect(() => encrypt(big, key)).toThrow('Blob too large')
  })

  it('accepts a blob at the limit', () => {
    const overhead = encrypt({ v: 1, t: 1, u: 1, type: 'text', data: { content: '' } }, key).length
    const fits: Payload = {
      v: 1,
      t: 1,
      u: 1,
      type: 'text',
      data: { content: 'x'.repeat(MAX_BLOB_BYTES - overhead) },
    }
    expect(encrypt(fits, key)).toHaveLength(MAX_BLOB_BYTES)
  })

  it('rejects a decrypted value that is not a payload', () => {
    const bad = { v: 2, t: 1, u: 1, type: 'text', data: { content: 'x' } } as unknown as Payload
    expect(() => decrypt(encrypt(bad, key), key)).toThrow('Invalid payload')
    const bad2 = { v: 1, t: 1, u: 1, type: 'kv', data: { entries: [{ k: 1, v: 'a' }] } } as unknown as Payload
    expect(() => decrypt(encrypt(bad2, key), key)).toThrow('Invalid payload')
  })
})
