import {
  BLOB_ID_BYTES,
  BLOB_ID_LENGTH,
  BLOB_VERSION,
  fromBase64Url,
  isBase64Url,
  MAX_BLOB_BYTES,
  MAX_VERSION,
  MIN_BLOB_BYTES,
  PUBLIC_KEY_BYTES,
  SIGNATURE_BYTES,
} from '@onekey-locker/crypto'

/** Largest JSON body the server reads. A 16 KB blob is about 22 KB in base64url. */
export const MAX_BODY_BYTES = 32 * 1024

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** A blob id is exactly the canonical base64url form of 16 bytes (22 characters). */
export const parseBlobId = (value: unknown): Result<string> => {
  if (typeof value !== 'string' || value.length !== BLOB_ID_LENGTH || !isBase64Url(value)) {
    return fail(`id must be a ${BLOB_ID_LENGTH}-character base64url string (${BLOB_ID_BYTES} bytes)`)
  }
  return { ok: true, value }
}

const parseBytes = (value: unknown, name: string): Result<Uint8Array> => {
  if (typeof value !== 'string' || !isBase64Url(value))
    return fail(`${name} must be a base64url string without padding`)
  return { ok: true, value: fromBase64Url(value) }
}

const parseFixedBytes = (value: unknown, name: string, length: number): Result<Uint8Array> => {
  const bytes = parseBytes(value, name)
  if (!bytes.ok) return bytes
  if (bytes.value.length !== length) return fail(`${name} must be exactly ${length} bytes`)
  return bytes
}

export const parseCiphertext = (value: unknown): Result<Uint8Array> => {
  const bytes = parseBytes(value, 'ciphertext')
  if (!bytes.ok) return bytes
  if (bytes.value.length < MIN_BLOB_BYTES || bytes.value.length > MAX_BLOB_BYTES) {
    return fail(`ciphertext must be between ${MIN_BLOB_BYTES} and ${MAX_BLOB_BYTES} bytes`)
  }
  if (bytes.value[0] !== BLOB_VERSION)
    return fail(`ciphertext has an unsupported blob version (first byte must be ${BLOB_VERSION})`)
  return bytes
}

/** The body must be a plain JSON object with exactly these fields, nothing more, nothing less. */
const parseFields = (body: unknown, allowed: readonly string[]): Result<Record<string, unknown>> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('body must be a JSON object')
  const fields = body as Record<string, unknown>
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) return fail(`unknown field: ${key.slice(0, 40)}`)
  }
  for (const key of allowed) {
    if (!Object.hasOwn(fields, key)) return fail(`missing field: ${key}`)
  }
  return { ok: true, value: fields }
}

export interface CreateInput {
  id: string
  ciphertext: Uint8Array
  writePublicKey: Uint8Array
}

export const parseCreateBody = (body: unknown): Result<CreateInput> => {
  const fields = parseFields(body, ['id', 'ciphertext', 'writePublicKey'])
  if (!fields.ok) return fields
  const id = parseBlobId(fields.value.id)
  if (!id.ok) return id
  const ciphertext = parseCiphertext(fields.value.ciphertext)
  if (!ciphertext.ok) return ciphertext
  const writePublicKey = parseFixedBytes(fields.value.writePublicKey, 'writePublicKey', PUBLIC_KEY_BYTES)
  if (!writePublicKey.ok) return writePublicKey
  return { ok: true, value: { id: id.value, ciphertext: ciphertext.value, writePublicKey: writePublicKey.value } }
}

export interface UpdateInput {
  ciphertext: Uint8Array
  version: number
  signature: Uint8Array
}

export const parseUpdateBody = (body: unknown): Result<UpdateInput> => {
  const fields = parseFields(body, ['ciphertext', 'version', 'signature'])
  if (!fields.ok) return fields
  const ciphertext = parseCiphertext(fields.value.ciphertext)
  if (!ciphertext.ok) return ciphertext
  const version = fields.value.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > MAX_VERSION) {
    return fail(`version must be an integer between 1 and ${MAX_VERSION}`)
  }
  const signature = parseFixedBytes(fields.value.signature, 'signature', SIGNATURE_BYTES)
  if (!signature.ok) return signature
  return { ok: true, value: { ciphertext: ciphertext.value, version, signature: signature.value } }
}
