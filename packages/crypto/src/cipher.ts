import nacl from 'tweetnacl'

export interface Payload {
  v: 1 // schema version
  t: number // created timestamp (ms)
  u: number // updated timestamp (ms)
  type: 'text' | 'kv' | 'json'
  data: { content: string } | { entries: Array<{ k: string; v: string }> } | { content: unknown }
}

/** Blob wire format: [version: 1 byte][nonce: 24 bytes][secretbox ciphertext incl. 16-byte MAC] */
export const BLOB_VERSION = 1
export const NONCE_BYTES = 24
export const MAC_BYTES = 16
/** Smallest possible blob: version + nonce + MAC. */
export const MIN_BLOB_BYTES = 1 + NONCE_BYTES + MAC_BYTES
/** Largest blob the server accepts. */
export const MAX_BLOB_BYTES = 16 * 1024

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

const isPayload = (x: unknown): x is Payload => {
  if (!isObject(x) || x.v !== 1 || !Number.isFinite(x.t) || !Number.isFinite(x.u) || !isObject(x.data)) return false
  if (x.type === 'text') return typeof x.data.content === 'string'
  if (x.type === 'kv') {
    const entries = x.data.entries
    return (
      Array.isArray(entries) && entries.every((e) => isObject(e) && typeof e.k === 'string' && typeof e.v === 'string')
    )
  }
  return x.type === 'json' && 'content' in x.data
}

/**
 * Encrypt a payload with the read key.
 */
export function encrypt(payload: Payload, key: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('Key must be 32 bytes')

  const nonce = nacl.randomBytes(NONCE_BYTES)
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = nacl.secretbox(plaintext, nonce, key)

  const blob = new Uint8Array(1 + NONCE_BYTES + ciphertext.length)
  blob[0] = BLOB_VERSION
  blob.set(nonce, 1)
  blob.set(ciphertext, 1 + NONCE_BYTES)

  if (blob.length > MAX_BLOB_BYTES) throw new Error(`Blob too large: ${blob.length} bytes, limit ${MAX_BLOB_BYTES}`)
  return blob
}

/**
 * Decrypt a blob with the read key.
 */
export function decrypt(blob: Uint8Array, key: Uint8Array): Payload {
  if (key.length !== 32) throw new Error('Key must be 32 bytes')
  if (blob.length < MIN_BLOB_BYTES) throw new Error('Blob too short')
  if (blob[0] !== BLOB_VERSION) throw new Error(`Unsupported version: ${blob[0]}`)

  const nonce = blob.slice(1, 1 + NONCE_BYTES)
  const ciphertext = blob.slice(1 + NONCE_BYTES)
  const plaintext = nacl.secretbox.open(ciphertext, nonce, key)

  if (!plaintext) throw new Error('Decryption failed')

  const payload: unknown = JSON.parse(new TextDecoder().decode(plaintext))
  if (!isPayload(payload)) throw new Error('Invalid payload')
  return payload
}

/**
 * Get encrypted blob size in bytes
 */
export function getBlobSize(blob: Uint8Array): number {
  return blob.length
}

/**
 * Test if key can decrypt blob without exposing plaintext
 */
export function canDecrypt(blob: Uint8Array, key: Uint8Array): boolean {
  try {
    decrypt(blob, key)
    return true
  } catch {
    return false
  }
}
