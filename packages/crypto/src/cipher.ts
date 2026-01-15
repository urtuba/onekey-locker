import nacl from "tweetnacl";

export interface Payload {
  v: 1; // schema version
  t: number; // created timestamp (ms)
  u: number; // updated timestamp (ms)
  type: "text" | "kv" | "json";
  data:
    | { content: string }
    | { entries: Array<{ k: string; v: string }> }
    | { content: unknown };
}

/**
 * Encrypt payload with public key
 * Wire format: [version: 1 byte][nonce: 24 bytes][ciphertext]
 */
export function encrypt(payload: Payload, key: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error("Key must be 32 bytes");

  const nonce = nacl.randomBytes(24);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = nacl.secretbox(plaintext, nonce, key);

  // Prepend version byte + nonce
  const blob = new Uint8Array(1 + 24 + ciphertext.length);
  blob[0] = 1; // version
  blob.set(nonce, 1);
  blob.set(ciphertext, 25);

  return blob;
}

/**
 * Decrypt blob with public key
 */
export function decrypt(blob: Uint8Array, key: Uint8Array): Payload {
  if (key.length !== 32) throw new Error("Key must be 32 bytes");
  if (blob.length < 25) throw new Error("Blob too short");
  if (blob[0] !== 1) throw new Error(`Unsupported version: ${blob[0]}`);

  const nonce = blob.slice(1, 25);
  const ciphertext = blob.slice(25);
  const plaintext = nacl.secretbox.open(ciphertext, nonce, key);

  if (!plaintext) throw new Error("Decryption failed");

  return JSON.parse(new TextDecoder().decode(plaintext)) as Payload;
}

/**
 * Get encrypted blob size in bytes
 */
export function getBlobSize(blob: Uint8Array): number {
  return blob.length;
}

/**
 * Test if key can decrypt blob without exposing plaintext
 */
export function canDecrypt(blob: Uint8Array, key: Uint8Array): boolean {
  try {
    decrypt(blob, key);
    return true;
  } catch {
    return false;
  }
}
