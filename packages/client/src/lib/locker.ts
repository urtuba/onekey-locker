import {
  decrypt,
  deriveKeys,
  deriveViewKeys,
  encrypt,
  fromBase64Url,
  generateSecret,
  signUpdate,
  toBase64Url,
} from '@onekey-locker/crypto'
import { ApiError, type BlobApi } from './api'
import { type Entry, entriesToPayload, payloadToEntries, validateEntries } from './templates'

export type LockerErrorCode =
  | 'invalid'
  | 'not-found'
  | 'conflict'
  | 'rejected'
  | 'decrypt'
  | 'too-large'
  | 'network'
  | 'server'

export class LockerError extends Error {
  constructor(
    readonly code: LockerErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'LockerError'
  }
}

/** What a viewer or an editor sees after opening a link. */
export interface OpenedLocker {
  blobId: string
  entries: Entry[]
  version: number
  createdAt: number
  updatedAt: number
}

const MESSAGES: Record<LockerErrorCode, string> = {
  invalid: 'The content cannot be saved.',
  'not-found': 'No locker exists for this link. It may be wrong or incomplete.',
  conflict: 'This locker was changed somewhere else. Reload to see the latest version, then edit again.',
  rejected: 'The server rejected the update. The edit link may not belong to this locker.',
  decrypt: 'The content could not be decrypted. The link is wrong, or the stored data is damaged.',
  'too-large': 'The content is too large. Remove some text.',
  network: 'Cannot reach the server. Check your connection and try again.',
  server: 'The server had a problem. Try again later.',
}

const toLockerError = (error: unknown): LockerError => {
  if (error instanceof LockerError) return error
  if (error instanceof ApiError) {
    if (error.status === 0) return new LockerError('network', MESSAGES.network)
    if (error.status === 404) return new LockerError('not-found', MESSAGES['not-found'])
    if (error.status === 409) return new LockerError('conflict', MESSAGES.conflict)
    if (error.status === 401) return new LockerError('rejected', MESSAGES.rejected)
    if (error.status === 400) return new LockerError('invalid', error.message)
    return new LockerError('server', MESSAGES.server)
  }
  return new LockerError('server', MESSAGES.server)
}

const encryptOrThrow = (...args: Parameters<typeof encrypt>): Uint8Array => {
  try {
    return encrypt(...args)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Blob too large')) {
      throw new LockerError('too-large', MESSAGES['too-large'])
    }
    throw error
  }
}

const openBlob = async (api: BlobApi, blobId: string, readKey: Uint8Array): Promise<OpenedLocker> => {
  try {
    const blob = await api.get(blobId)
    const payload = decrypt(fromBase64Url(blob.ciphertext), readKey)
    return {
      blobId,
      entries: payloadToEntries(payload),
      version: blob.version,
      createdAt: payload.t,
      updatedAt: payload.u,
    }
  } catch (error) {
    if (error instanceof ApiError) throw toLockerError(error)
    throw new LockerError('decrypt', MESSAGES.decrypt)
  }
}

/** Make a new secret, encrypt the entries in the browser and store the ciphertext. */
export const createLocker = async (api: BlobApi, entries: Entry[], now = Date.now()) => {
  const problem = validateEntries(entries)
  if (problem) throw new LockerError('invalid', problem)

  const secret = generateSecret()
  const { readKey, blobId, writeKeyPair } = deriveKeys(secret)
  const blob = encryptOrThrow(entriesToPayload(entries, now, now), readKey)
  try {
    await api.create({
      id: blobId,
      ciphertext: toBase64Url(blob),
      writePublicKey: toBase64Url(writeKeyPair.publicKey),
    })
  } catch (error) {
    throw toLockerError(error)
  }
  return { secret, readKey, blobId }
}

/** Open a locker with the view link's read key. */
export const openForView = (api: BlobApi, readKey: Uint8Array): Promise<OpenedLocker> =>
  openBlob(api, deriveViewKeys(readKey).blobId, readKey)

/** Open a locker with the edit link's secret. */
export const openForEdit = (api: BlobApi, secret: Uint8Array): Promise<OpenedLocker> => {
  const { readKey, blobId } = deriveKeys(secret)
  return openBlob(api, blobId, readKey)
}

/**
 * Save a change: encrypt, sign (id, version + 1, hash of the new blob) and send.
 * Only the ciphertext, the new version and the signature leave the browser.
 */
export const saveEdit = async (
  api: BlobApi,
  secret: Uint8Array,
  current: Pick<OpenedLocker, 'version' | 'createdAt'>,
  entries: Entry[],
  now = Date.now()
): Promise<OpenedLocker> => {
  const problem = validateEntries(entries)
  if (problem) throw new LockerError('invalid', problem)

  const { readKey, blobId, writeKeyPair } = deriveKeys(secret)
  const payload = entriesToPayload(entries, current.createdAt, now)
  const blob = encryptOrThrow(payload, readKey)
  const version = current.version + 1
  const signature = signUpdate(blobId, version, blob, writeKeyPair.secretKey)
  try {
    await api.update(blobId, { ciphertext: toBase64Url(blob), version, signature: toBase64Url(signature) })
  } catch (error) {
    throw toLockerError(error)
  }
  return { blobId, entries: payloadToEntries(payload), version, createdAt: current.createdAt, updatedAt: now }
}

export const errorMessage = (error: unknown): string => toLockerError(error).message
