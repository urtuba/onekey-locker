import { fromBase64Url, isBase64Url, toBase64Url } from './encoding'

describe('base64url encoding', () => {
  it('encodes and decodes correctly', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 254])
    const encoded = toBase64Url(original)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(original)
  })

  it('matches Node base64url for every length up to 40', () => {
    for (let n = 0; n <= 40; n++) {
      const bytes = new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + n) % 256))
      const expected = Buffer.from(bytes).toString('base64url')
      expect(toBase64Url(bytes)).toBe(expected)
      expect(fromBase64Url(expected)).toEqual(bytes)
    }
  })

  it('round-trips large blobs (16 KB)', () => {
    const bytes = new Uint8Array(16384).map((_, i) => (i * 7) % 256)
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
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

  it('rejects anything that is not strict, canonical base64url', () => {
    const bad = ['!!!', 'AAAA=', 'AA==', 'AA+A', 'AA/A', 'AA A', 'AA\nA', 'A', 'AAAAA', 'AB', 'ééé', '\u0000AAA']
    for (const s of bad) {
      expect(() => fromBase64Url(s)).toThrow('Invalid base64url')
      expect(isBase64Url(s)).toBe(false)
    }
  })

  it('accepts the empty string and canonical strings', () => {
    expect(fromBase64Url('')).toEqual(new Uint8Array(0))
    expect(isBase64Url('AAAA')).toBe(true)
    expect(isBase64Url('AQ')).toBe(true)
  })

  it('isBase64Url is false for non-strings', () => {
    expect(isBase64Url(undefined)).toBe(false)
    expect(isBase64Url(12)).toBe(false)
    expect(isBase64Url({})).toBe(false)
  })
})
