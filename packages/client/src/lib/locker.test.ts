import { deriveKeys, encrypt, generateSecret, signUpdate, toBase64Url } from '@onekey-locker/crypto'
import { describe, expect, it } from 'vitest'
import { createFakeApi } from '../testing/fakeApi'
import { createLocker, openForEdit, openForView, saveEdit } from './locker'
import { entriesToPayload } from './templates'

const entries = [
  { k: 'Name', v: 'Max' },
  { k: 'Phone', v: '+1 555 0123' },
]

describe('create, view, edit', () => {
  it('creates a locker that the view key and the secret can both open', async () => {
    const { api } = createFakeApi()
    const { secret, readKey, blobId } = await createLocker(api, entries, 1000)

    const viewed = await openForView(api, readKey)
    expect(viewed.entries).toEqual(entries)
    expect(viewed.version).toBe(1)
    expect(viewed.blobId).toBe(blobId)
    expect(viewed.createdAt).toBe(1000)

    const edited = await openForEdit(api, secret)
    expect(edited.entries).toEqual(entries)
  })

  it('what is sent to the server contains neither the secret, the read key nor the content', async () => {
    const { api, seen } = createFakeApi()
    const { secret, readKey } = await createLocker(api, [{ k: 'Name', v: 'UniqueContentMarker' }])
    const sent = JSON.stringify(seen)
    expect(sent).not.toContain(toBase64Url(secret))
    expect(sent).not.toContain(toBase64Url(readKey))
    expect(sent).not.toContain('UniqueContentMarker')
    expect(sent).not.toContain('Name')
  })

  it('saves an edit with a signature, and the viewer sees the change', async () => {
    const { api } = createFakeApi()
    const { secret, readKey } = await createLocker(api, entries, 1000)
    const opened = await openForEdit(api, secret)

    const saved = await saveEdit(api, secret, opened, [{ k: 'Name', v: 'Rex' }], 2000)
    expect(saved.version).toBe(2)
    expect(saved.updatedAt).toBe(2000)

    const viewed = await openForView(api, readKey)
    expect(viewed.entries).toEqual([{ k: 'Name', v: 'Rex' }])
    expect(viewed.version).toBe(2)
    expect(viewed.createdAt).toBe(1000)
    expect(viewed.updatedAt).toBe(2000)
  })

  it('two editors: the second one gets a conflict', async () => {
    const { api } = createFakeApi()
    const { secret } = await createLocker(api, entries)
    const a = await openForEdit(api, secret)
    const b = await openForEdit(api, secret)
    await saveEdit(api, secret, a, [{ k: 'Name', v: 'A' }])
    await expect(saveEdit(api, secret, b, [{ k: 'Name', v: 'B' }])).rejects.toMatchObject({ code: 'conflict' })
    // Reload, then the edit works.
    const fresh = await openForEdit(api, secret)
    await expect(saveEdit(api, secret, fresh, [{ k: 'Name', v: 'B' }])).resolves.toMatchObject({ version: 3 })
  })

  it('a signature from another secret cannot update a locker', async () => {
    const { api } = createFakeApi()
    const mine = await createLocker(api, entries)
    const other = deriveKeys(generateSecret())
    const blob = encrypt(entriesToPayload([{ k: 'a', v: 'evil' }], 1, 2), other.readKey)
    const signature = signUpdate(mine.blobId, 2, blob, other.writeKeyPair.secretKey)
    await expect(
      api.update(mine.blobId, { ciphertext: toBase64Url(blob), version: 2, signature: toBase64Url(signature) })
    ).rejects.toMatchObject({ status: 401 })
    expect((await openForEdit(api, mine.secret)).entries).toEqual(entries)
  })

  it('a wrong key gives a clear error, not a crash', async () => {
    const { api } = createFakeApi()
    await createLocker(api, entries)
    await expect(openForView(api, new Uint8Array(32))).rejects.toMatchObject({ code: 'not-found' })
  })

  it('damaged ciphertext gives a decrypt error', async () => {
    const { api, store } = createFakeApi()
    const { readKey, blobId } = await createLocker(api, entries)
    const row = store.get(blobId)
    if (!row) throw new Error('missing')
    row.ciphertext = toBase64Url(new Uint8Array(80).fill(1))
    await expect(openForView(api, readKey)).rejects.toMatchObject({ code: 'decrypt' })
  })

  it('refuses empty content and content over the size limit before sending anything', async () => {
    const { api, seen } = createFakeApi()
    await expect(createLocker(api, [{ k: 'a', v: '  ' }])).rejects.toMatchObject({ code: 'invalid' })
    const big = Array.from({ length: 30 }, (_, i) => ({ k: `f${i}`, v: 'é'.repeat(1000) }))
    await expect(createLocker(api, big)).rejects.toMatchObject({ code: 'too-large' })
    expect(seen).toHaveLength(0)
  })

  it('maps server errors to messages', async () => {
    const { api } = createFakeApi()
    const failing = { ...api, create: async () => Promise.reject(new (await import('./api')).ApiError(0, 'x')) }
    await expect(createLocker(failing, entries)).rejects.toMatchObject({ code: 'network' })
  })
})
