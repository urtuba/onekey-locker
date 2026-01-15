import nacl from 'tweetnacl'

export interface KeyPair {
  privateKey: Uint8Array // 32 bytes
  publicKey: Uint8Array // 32 bytes
}

/**
 * Generate a cryptographic key pair
 * @param seed - Optional seed for additional entropy (does not allow key recreation)
 * @returns KeyPair with 32-byte keys
 */
export const generateKeyPair = (seed?: Uint8Array): KeyPair => {
  const randomBytes = nacl.randomBytes(32)
  const privateKey = seed && seed.length === 32 ? xorBytes(randomBytes, seed) : randomBytes
  const publicKey = nacl.hash(privateKey).slice(0, 32)

  return { privateKey, publicKey }
}

/**
 * Derive public key from private key
 * @param privateKey - 32-byte private key
 * @returns 32-byte public key
 */
export const derivePublicKey = (privateKey: Uint8Array): Uint8Array => {
  if (privateKey.length !== 32) {
    throw new Error('Private key must be 32 bytes')
  }

  return nacl.hash(privateKey).slice(0, 32)
}

/**
 * Derive blob ID from public key (16 bytes for URL identifier)
 * @param publicKey - 32-byte public key
 * @returns 16-byte blob ID
 */
export const deriveBlobId = (publicKey: Uint8Array): Uint8Array => {
  if (publicKey.length !== 32) {
    throw new Error('Public key must be 32 bytes')
  }

  return nacl.hash(publicKey).slice(0, 16)
}

/**
 * Derive full public key hash for storage/validation (32 bytes)
 * @param key - 32-byte public or private key
 * @returns 32-byte key hash
 */
export const deriveKeyHash = (key: Uint8Array): Uint8Array => {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes')
  }

  return nacl.hash(key).slice(0, 32)
}

/**
 * Verify that a public key matches the stored hash
 * @param key - 32-byte public or private key
 * @param storedHash - 32-byte stored hash
 * @returns true if key matches stored hash, false otherwise
 */
export const verifyKey = (key: Uint8Array, storedHash: Uint8Array): boolean => {
  const derived = deriveKeyHash(key)
  if (derived.length !== storedHash.length) return false
  for (let i = 0; i < derived.length; i++) {
    if (derived[i] !== storedHash[i]) return false
  }

  return true
}

/**
 * XOR two byte arrays
 * @param a - first byte array
 * @param b - second byte array
 * @returns XORed byte array
 */
const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const result = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    result[i] = a[i] ^ b[i]
  }
  return result
}
