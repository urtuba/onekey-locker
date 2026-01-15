import { fromBase64Url, toBase64Url } from './encoding'

describe('base64url encoding', () => {
  it('encodes and decodes correctly', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 254])
    const encoded = toBase64Url(original)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(original)
  })

  it('produces URL-safe output', () => {
    const bytes = new Uint8Array(32).fill(255)
    const encoded = toBase64Url(bytes)
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('=')
  })

  it('handles 32-byte keys', () => {
    const key = new Uint8Array(32).fill(42)
    const encoded = toBase64Url(key)
    expect(encoded).toHaveLength(43)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(key)
  })
})