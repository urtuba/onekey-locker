const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const LOOKUP = new Int8Array(128).fill(-1)
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i

/**
 * Encode bytes as URL-safe base64 (RFC 4648 section 5), without padding.
 */
export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63]
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63]
  }
  return out
}

/**
 * Decode URL-safe base64 to bytes. Strict: only the base64url alphabet, no padding,
 * no whitespace, and only the canonical encoding (unused trailing bits must be zero),
 * so that `toBase64Url(fromBase64Url(s)) === s` for every string that is accepted.
 * Throws on anything else.
 */
export function fromBase64Url(str: string): Uint8Array {
  if (typeof str !== 'string') throw new Error('Invalid base64url')
  const len = str.length
  if (len % 4 === 1) throw new Error('Invalid base64url')
  const out = new Uint8Array(Math.floor((len * 3) / 4))
  let acc = 0
  let bits = 0
  let o = 0
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i)
    const v = code < 128 ? LOOKUP[code] : -1
    if (v < 0) throw new Error('Invalid base64url')
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[o++] = (acc >> bits) & 255
      acc &= (1 << bits) - 1
    }
  }
  if (acc !== 0) throw new Error('Invalid base64url')
  return out
}

/**
 * True if `str` is strict, canonical base64url (see `fromBase64Url`).
 */
export function isBase64Url(str: unknown): str is string {
  if (typeof str !== 'string') return false
  try {
    fromBase64Url(str)
    return true
  } catch {
    return false
  }
}
