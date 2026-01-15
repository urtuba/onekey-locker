import nacl from 'tweetnacl'

export interface KeyPair {
  privateKey: Uint8Array // 32 bytes
  publicKey: Uint8Array // 32 bytes
}

/**
 * Generate a cryptographic key pair
 *
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
 */
export const derivePublicKey = (privateKey: Uint8Array): Uint8Array => {
  if (privateKey.length !== 32) {
    throw new Error('Private key must be 32 bytes')
  }

  return nacl.hash(privateKey).slice(0, 32) as Uint8Array
}

/**
 * XOR two byte arrays
 */
const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const result = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    result[i] = a[i] ^ b[i]
  }

  return result
}
