# @onekey-locker/crypto

Cryptographic primitives for OneKey Locker. Handles key generation, encryption/decryption, and encoding for zero-knowledge blob storage.

## Core Concepts

**KeyPair:**
- `privateKey` (32 bytes): the owner's secret. The other keys are derived from it.
- `publicKey` (32 bytes): the first 32 bytes of SHA-512(privateKey). Despite the name, it is **not** a public key: it is the secret symmetric key that encrypts the content, so anyone who has it can read the blob. Think of it as the read key.

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
function deriveBlobId(publicKey: Uint8Array): Uint8Array   // first 16 bytes of SHA-512(publicKey)
function deriveKeyHash(key: Uint8Array): Uint8Array        // first 32 bytes of SHA-512(key)
function verifyKey(key: Uint8Array, storedHash: Uint8Array): boolean // deriveKeyHash(key) equals storedHash
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
import { generateKeyPair, encrypt, getBlobSize } from '@onekey-locker/crypto'

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

const publicKey = fromBase64Url('A7b2C9d8E4f1G6h3I0j5K2l9...') // the read key
const storedHash = deriveKeyHash(publicKey)                     // what a server would keep

// Check a key against the stored hash
if (!verifyKey(publicKey, storedHash)) {
  throw new Error('Wrong key')
}

// Decrypt
const payload = decrypt(blob, publicKey)
console.log(payload.data)
```

### Blob Identifiers
```typescript
import { deriveBlobId, deriveKeyHash } from '@onekey-locker/crypto'

const blobId = toBase64Url(deriveBlobId(publicKey))   // short ID for URLs and storage
const keyHash = deriveKeyHash(publicKey)               // full hash for verification
```

## Security

- **Encryption:** XSalsa20-Poly1305 (`nacl.secretbox` from tweetnacl), a symmetric cipher. There is no X25519 key exchange.
- **Key derivation:** SHA-512 (truncated) for the read key, the blob ID and key hashes
- **Key strength:** 256 bits (2^256 keyspace)
- **Collision risk:** Negligible at scale (128 bits stronger than UUIDs)

## Notes

- Optional `seed` parameter adds entropy via XOR, does not make keys deterministic
- The blob ID is a hash of the read key, so it does not reveal the key
- Because the read key is a hash of the private key, anyone who sees the private key can read the blob. A server must never receive it; see "Design review" in the [root README](../../README.md#design-review)