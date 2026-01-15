# @onekey-locker/crypto

Cryptographic primitives for OneKey Locker. Provides key generation and encoding for zero-knowledge encrypted storage.

## API

```typescript
interface KeyPair {
  privateKey: Uint8Array  // 32 bytes
  publicKey: Uint8Array   // 32 bytes
}

function generateKeyPair(seed?: Uint8Array): KeyPair
function derivePublicKey(privateKey: Uint8Array): Uint8Array
function toBase64Url(bytes: Uint8Array): string
function fromBase64Url(str: string): Uint8Array
```

## Keys

**Private Key:**
- Randomly generated (or XORed with seed)
- Must remain secret
- Allows derivation of public key
- Used for API authentication via `derivePublicKey(privKey) === storedPubKey`

**Public Key:**
- Deterministically derived: `hash(privateKey)[0:32]`
- Safe to expose (acts as blob ID)
- Used as encryption key
- Derivation is fast (single SHA-512 hash, truncated)

### Format

| Key | Size | Encoded Length | Purpose |
|-----|------|----------------|---------|
| Private Key | 32 bytes (256 bits) | 43 chars | Full access (decrypt + update) |
| Public Key | 32 bytes (256 bits) | 43 chars | Encryption key + blob identifier |

**Encoding:** Base64url (URL-safe, no padding: `A-Za-z0-9_-`)


### Private Key Security

**Entropy:** 256 bits = 2^256 possible keys

**Brute force resistance:**
- At 1 billion guesses/second: ~3.67 × 10^64 years to exhaust keyspace
- At current Bitcoin network hashrate (600 EH/s): ~10^54 years
- **Conclusion:** Computationally infeasible to guess

**Note on seed mixing:** 
```typescript
privateKey = random(32) XOR seed(32)  // seed adds entropy, doesn't make deterministic
```
Seed cannot recreate the same key because randomness dominates. XOR prevents seed alone from determining output.

### Public Key Collision Risk

```
P(collision) ≈ 1 - e^(-n²/2^k)
where k = 256 bits, n = number of keys
```

**Collision probabilities:**

| Keys Generated | Collision Probability |
|----------------|----------------------|
| 2^128 (~10^38) | ~50% |
| 2^64 (~10^19)  | ~0.0000001% |
| 1 billion      | ~10^-60 |
| 1 trillion     | ~10^-54 |

**Real-world context:**
- UUID (128 bits): 50% collision at ~2^64 UUIDs
- SHA256 (256 bits): 50% collision at ~2^128 hashes
- OneKey public keys: **128 bits stronger than UUIDs**

**Practical risk:** If you generate 1 billion blobs, collision chance is ~10^-60 (effectively zero).

## Examples

### Generate Keys
```typescript
import { generateKeyPair, toBase64Url } from '@onekey-locker/crypto'

const { privateKey, publicKey } = generateKeyPair()

console.log('Private:', toBase64Url(privateKey))
// Private: X3k9mP_Qa8vL2nR4tY6uI0oP9aS8dF7gH1jK5lZ3xC4

console.log('Public:', toBase64Url(publicKey))  
// Public: A7b2C9d8E4f1G6h3I0j5K2l9M8n7O4p1Q6r3S0t5U2v9
```

### Derive Public from Private
```typescript
import { derivePublicKey, toBase64Url, fromBase64Url } from '@onekey-locker/crypto'

const privKeyStr = 'X3k9mP_Qa8vL2nR4tY6uI0oP9aS8dF7gH1jK5lZ3xC4'
const privateKey = fromBase64Url(privKeyStr)

const publicKey = derivePublicKey(privateKey)
console.log(toBase64Url(publicKey))
// A7b2C9d8E4f1G6h3I0j5K2l9M8n7O4p1Q6r3S0t5U2v9
```

### With Optional Seed
```typescript
const seed = new Uint8Array(32).fill(42) // User-provided entropy
const { privateKey, publicKey } = generateKeyPair(seed)

// Note: Same seed will NOT produce same keys (random bytes mixed in)
```