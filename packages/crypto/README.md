# @onekey-locker/crypto

Cryptographic primitives for OneKey Locker. Handles key generation, encryption/decryption, and encoding for zero-knowledge blob storage.

## Core Concepts

**KeyPair:**
- `privateKey` (32 bytes): Secret, proves ownership, derives publicKey
- `publicKey` (32 bytes): Derived from privateKey via SHA-512, used as encryption key and blob identifier

**Payload:** Encrypted content structure
```typescript
interface Payload {
  v: 1                           // schema version
  t: number                      // created timestamp (ms)
  u: number                      // updated timestamp (ms)
  type: 'text' | 'kv' | 'json'
  data: { content: string } | { entries: Array<{k: string, v: string}> } | { content: unknown }
}
```

**Blob:** Encrypted payload with wire format: `[version: 1 byte][nonce: 24 bytes][ciphertext]`

**Encoding:** Base64url (URL-safe, no padding)

## API

### Keys
```typescript
function generateKeyPair(seed?: Uint8Array): KeyPair
function deriveBlobId(publicKey: Uint8Array): string  // First 16 bytes, base64url
function deriveKeyHash(publicKey: Uint8Array): string // SHA-256 hash, base64url
function verifyKey(privateKey: Uint8Array, publicKey: Uint8Array): boolean
```

### Cipher
```typescript
function encrypt(payload: Payload, publicKey: Uint8Array): Uint8Array
function decrypt(blob: Uint8Array, publicKey: Uint8Array): Payload
function canDecrypt(blob: Uint8Array, publicKey: Uint8Array): boolean
function getBlobSize(blob: Uint8Array): number
```

### Encoding
```typescript
function toBase64Url(bytes: Uint8Array): string
function fromBase64Url(str: string): Uint8Array
```

## Examples

### Create and Encrypt
```typescript
import { generateKeyPair, encrypt, toBase64Url } from '@onekey-locker/crypto'

const { privateKey, publicKey } = generateKeyPair()

const payload = {
  v: 1,
  t: Date.now(),
  u: Date.now(),
  type: 'text',
  data: { content: 'Secret message' }
}

const blob = encrypt(payload, publicKey)
console.log('Encrypted size:', getBlobSize(blob), 'bytes')
```

### Decrypt and Verify
```typescript
import { decrypt, verifyKey, fromBase64Url } from '@onekey-locker/crypto'

const privateKey = fromBase64Url('X3k9mP_Qa8vL2nR4tY6uI0oP...')
const publicKey = fromBase64Url('A7b2C9d8E4f1G6h3I0j5K2l9...')

// Verify ownership
if (!verifyKey(privateKey, publicKey)) {
  throw new Error('Invalid private key')
}

// Decrypt
const payload = decrypt(blob, publicKey)
console.log(payload.data)
```

### Blob Identifiers
```typescript
import { deriveBlobId, deriveKeyHash } from '@onekey-locker/crypto'

const blobId = deriveBlobId(publicKey)      // Short ID for storage
const keyHash = deriveKeyHash(publicKey)    // Full hash for verification
```

## Security

- **Encryption:** X25519 + XSalsa20-Poly1305 (tweetnacl)
- **Key derivation:** SHA-512 for publicKey, SHA-256 for hashes
- **Key strength:** 256 bits (2^256 keyspace)
- **Collision risk:** Negligible at scale (128 bits stronger than UUIDs)

## Notes

- Optional `seed` parameter adds entropy via XOR, does not make keys deterministic
- Public key doubles as encryption key and blob identifier
- Private key proves ownership by deriving matching public key