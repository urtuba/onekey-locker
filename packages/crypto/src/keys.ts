import nacl from 'tweetnacl'
import { toBase64Url } from './encoding.js'

/**
 * Key scheme (v1). Everything is derived from one random 32-byte `secret`:
 *
 *   readKey      = SHA-512("onekey-locker/read/v1"  || secret)[0:32]   encrypts the content
 *   blobId       = base64url(SHA-512("onekey-locker/id/v1" || readKey)[0:16])
 *   writeKeyPair = Ed25519 keypair from seed SHA-512("onekey-locker/write/v1" || secret)[0:32]
 *
 * The view link carries `readKey`. The edit link carries `secret`. The server gets the
 * blobId and the Ed25519 public key only, so it cannot derive `readKey` or `secret`.
 */

export const SECRET_BYTES = 32
export const READ_KEY_BYTES = 32
export const BLOB_ID_BYTES = 16
export const BLOB_ID_LENGTH = 22 // base64url of 16 bytes

export const READ_DOMAIN = 'onekey-locker/read/v1'
export const ID_DOMAIN = 'onekey-locker/id/v1'
export const WRITE_DOMAIN = 'onekey-locker/write/v1'

export interface WriteKeyPair {
  /** Ed25519 public key (32 bytes). The only key material the server stores. */
  publicKey: Uint8Array
  /** Ed25519 secret key (64 bytes, tweetnacl format). Never leaves the client. */
  secretKey: Uint8Array
}

export interface DerivedKeys {
  readKey: Uint8Array
  blobId: string
  writeKeyPair: WriteKeyPair
}

const encoder = new TextEncoder()

/** SHA-512(domain || data), first `length` bytes. */
const domainHash = (domain: string, data: Uint8Array, length: number): Uint8Array => {
  const prefix = encoder.encode(domain)
  const input = new Uint8Array(prefix.length + data.length)
  input.set(prefix, 0)
  input.set(data, prefix.length)
  return nacl.hash(input).slice(0, length)
}

const assertLength = (bytes: Uint8Array, length: number, name: string): void => {
  if (!(bytes instanceof Uint8Array) || bytes.length !== length) {
    throw new Error(`${name} must be ${length} bytes`)
  }
}

/** A fresh random 32-byte secret. This is what the edit link carries. */
export const generateSecret = (): Uint8Array => nacl.randomBytes(SECRET_BYTES)

/** The key that encrypts and decrypts the content. This is what the view link carries. */
export const deriveReadKey = (secret: Uint8Array): Uint8Array => {
  assertLength(secret, SECRET_BYTES, 'Secret')
  return domainHash(READ_DOMAIN, secret, READ_KEY_BYTES)
}

/** The blob id, derived from the read key alone, so a viewer can find the blob. */
export const deriveBlobId = (readKey: Uint8Array): string => {
  assertLength(readKey, READ_KEY_BYTES, 'Read key')
  return toBase64Url(domainHash(ID_DOMAIN, readKey, BLOB_ID_BYTES))
}

/** The Ed25519 key pair that signs updates. Only the public key goes to the server. */
export const deriveWriteKeyPair = (secret: Uint8Array): WriteKeyPair => {
  assertLength(secret, SECRET_BYTES, 'Secret')
  const seed = domainHash(WRITE_DOMAIN, secret, 32)
  const { publicKey, secretKey } = nacl.sign.keyPair.fromSeed(seed)
  return { publicKey, secretKey }
}

/** All keys for an owner, derived from the secret. */
export const deriveKeys = (secret: Uint8Array): DerivedKeys => {
  const readKey = deriveReadKey(secret)
  return { readKey, blobId: deriveBlobId(readKey), writeKeyPair: deriveWriteKeyPair(secret) }
}

/** The keys a viewer can get from the view link: the read key and the blob id. */
export const deriveViewKeys = (readKey: Uint8Array): { readKey: Uint8Array; blobId: string } => ({
  readKey,
  blobId: deriveBlobId(readKey),
})
