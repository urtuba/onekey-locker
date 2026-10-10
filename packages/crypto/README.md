# @onekey-locker/crypto

Key derivation, encryption and signed updates for OneKey Locker. It runs in the browser and in Node. The server uses it only to check signatures.

## Key scheme

The owner has one random 32-byte `secret`. Everything else is derived from it with SHA-512 and a domain prefix:

| Key | Derivation | Who holds it |
|---|---|---|
| `readKey` | `SHA-512("onekey-locker/read/v1" ‖ secret)[0:32]` | the view link; encrypts the content (`nacl.secretbox`) |
| `blobId` | `base64url(SHA-512("onekey-locker/id/v1" ‖ readKey)[0:16])` | everyone; names the blob (22 characters) |
| write key pair | Ed25519 from seed `SHA-512("onekey-locker/write/v1" ‖ secret)[0:32]` | the edit link (the secret); the server stores only the public key |

The server gets the blob id, the ciphertext and the write public key. None of them leads to `readKey` or `secret`.

## Signed updates

An update is signed, never authenticated with a secret:

```
message = "onekey-locker/update/v1"   (23 bytes, UTF-8)
       ‖ blobId                       (22 bytes, ASCII)
       ‖ newVersion                   (4 bytes, big-endian)
       ‖ SHA-512(newBlob)             (64 bytes)
signature = Ed25519(message)          (64 bytes, detached)
```

The server checks the signature with the stored public key and requires `newVersion = storedVersion + 1`. A replayed request carries an old version and is rejected.

## Blob format

`[version: 1 byte = 1][nonce: 24 bytes][secretbox ciphertext, 16-byte MAC included]`. A blob is at least 41 bytes and at most 16 KB (`MIN_BLOB_BYTES`, `MAX_BLOB_BYTES`).

The decrypted content is a `Payload`:

```typescript
interface Payload {
  v: 1                          // schema version
  t: number                     // created (ms)
  u: number                     // updated (ms)
  type: 'text' | 'kv' | 'json'
  data: { content: string } | { entries: Array<{ k: string; v: string }> } | { content: unknown }
}
```

`decrypt` throws `Invalid payload` if the decrypted JSON does not match this shape.

## API

```typescript
// keys
generateSecret(): Uint8Array
deriveReadKey(secret): Uint8Array
deriveBlobId(readKey): string
deriveWriteKeyPair(secret): { publicKey: Uint8Array; secretKey: Uint8Array }
deriveKeys(secret): { readKey; blobId; writeKeyPair }
deriveViewKeys(readKey): { readKey; blobId }

// content
encrypt(payload, readKey): Uint8Array
decrypt(blob, readKey): Payload
canDecrypt(blob, readKey): boolean
getBlobSize(blob): number

// updates
buildUpdateMessage(blobId, newVersion, newBlob): Uint8Array
signUpdate(blobId, newVersion, newBlob, writeSecretKey): Uint8Array
verifyUpdate(blobId, newVersion, newBlob, signature, writePublicKey): boolean

// encoding (strict: only the base64url alphabet, no padding, canonical form)
toBase64Url(bytes): string
fromBase64Url(str): Uint8Array   // throws on invalid input
isBase64Url(value): boolean
```

## Tests

`npm run test:crypto` from the repository root. The key derivation and the update signature are checked against fixed vectors that were computed outside this code with `node:crypto`.

## Limits

- No forward secrecy: a leaked read key exposes every version of the content.
- A lost secret cannot be recovered.
