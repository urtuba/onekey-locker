import nacl from 'tweetnacl'
import { BLOB_ID_LENGTH } from './keys.js'

/**
 * Signed updates. The owner signs the message below with the Ed25519 write key.
 * The server checks the signature with the stored public key and requires
 * newVersion = storedVersion + 1, so an old signed request can never be replayed.
 *
 *   message = "onekey-locker/update/v1"          (23 bytes, UTF-8)
 *          || blobId                             (22 bytes, the canonical base64url id as ASCII)
 *          || newVersion                         (4 bytes, big-endian unsigned)
 *          || SHA-512(newBlob)                   (64 bytes)
 */

export const UPDATE_DOMAIN = 'onekey-locker/update/v1'
export const MAX_VERSION = 0x7fffffff // the database column is a signed 32-bit integer
export const SIGNATURE_BYTES = 64
export const PUBLIC_KEY_BYTES = 32

const encoder = new TextEncoder()

export const buildUpdateMessage = (blobId: string, newVersion: number, newBlob: Uint8Array): Uint8Array => {
  if (typeof blobId !== 'string' || blobId.length !== BLOB_ID_LENGTH) throw new Error('Invalid blob id')
  if (!Number.isInteger(newVersion) || newVersion < 1 || newVersion > MAX_VERSION) throw new Error('Invalid version')

  const domain = encoder.encode(UPDATE_DOMAIN)
  const id = encoder.encode(blobId)
  const hash = nacl.hash(newBlob)
  const message = new Uint8Array(domain.length + id.length + 4 + hash.length)
  message.set(domain, 0)
  message.set(id, domain.length)
  new DataView(message.buffer).setUint32(domain.length + id.length, newVersion, false)
  message.set(hash, domain.length + id.length + 4)
  return message
}

/** Sign an update with the write secret key. Returns a 64-byte detached signature. */
export const signUpdate = (
  blobId: string,
  newVersion: number,
  newBlob: Uint8Array,
  writeSecretKey: Uint8Array
): Uint8Array => {
  if (writeSecretKey.length !== nacl.sign.secretKeyLength) throw new Error('Write secret key must be 64 bytes')
  return nacl.sign.detached(buildUpdateMessage(blobId, newVersion, newBlob), writeSecretKey)
}

/** Check an update signature against the stored write public key. Never throws on bad input. */
export const verifyUpdate = (
  blobId: string,
  newVersion: number,
  newBlob: Uint8Array,
  signature: Uint8Array,
  writePublicKey: Uint8Array
): boolean => {
  if (signature.length !== SIGNATURE_BYTES || writePublicKey.length !== PUBLIC_KEY_BYTES) return false
  try {
    return nacl.sign.detached.verify(buildUpdateMessage(blobId, newVersion, newBlob), signature, writePublicKey)
  } catch {
    return false
  }
}
