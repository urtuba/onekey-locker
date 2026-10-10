import { fromBase64Url, verifyUpdate } from '@onekey-locker/crypto'
import { ApiError, type BlobApi, type BlobResponse } from '../lib/api'

/**
 * An in-memory server for tests. It follows the real API's rules for ids, signatures and
 * versions, and, like the real server, it only ever sees ciphertext, ids and public keys.
 */
export const createFakeApi = () => {
  const store = new Map<
    string,
    { ciphertext: string; writePublicKey: Uint8Array; version: number; createdAt: string }
  >()
  const seen: unknown[] = []

  const api: BlobApi = {
    async create(request) {
      seen.push(request)
      if (store.has(request.id)) throw new ApiError(409, 'a blob with this id already exists')
      store.set(request.id, {
        ciphertext: request.ciphertext,
        writePublicKey: fromBase64Url(request.writePublicKey),
        version: 1,
        createdAt: new Date().toISOString(),
      })
      return { id: request.id, version: 1 }
    },
    async get(id) {
      const row = store.get(id)
      if (!row) throw new ApiError(404, 'blob not found')
      const response: BlobResponse = {
        id,
        ciphertext: row.ciphertext,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      }
      return response
    },
    async update(id, request) {
      seen.push(request)
      const row = store.get(id)
      if (!row) throw new ApiError(404, 'blob not found')
      if (
        !verifyUpdate(
          id,
          request.version,
          fromBase64Url(request.ciphertext),
          fromBase64Url(request.signature),
          row.writePublicKey
        )
      ) {
        throw new ApiError(401, 'invalid signature')
      }
      if (request.version !== row.version + 1) throw new ApiError(409, 'wrong version')
      row.ciphertext = request.ciphertext
      row.version = request.version
      return { id, version: request.version }
    },
  }

  return { api, store, seen }
}
