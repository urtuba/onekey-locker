import { decrypt, deriveKeys, fromBase64Url, generateSecret, signUpdate, toBase64Url } from '@onekey-locker/crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, newLocker, setupDatabase, sql } from './helpers.js'

beforeEach(setupDatabase)
afterAll(async () => {
  await sql.end({ timeout: 5 })
})

const create = async (locker = newLocker()) => {
  const res = await call('POST', '/api/blob', locker.createBody())
  expect(res.status).toBe(201)
  return locker
}

describe('create, read and update', () => {
  it('creates a blob and reads it back; the reader decrypts it with the read key', async () => {
    const locker = newLocker('first text')
    const created = await call('POST', '/api/blob', locker.createBody())
    expect(created.status).toBe(201)
    expect(created.json).toEqual({ id: locker.blobId, version: 1 })

    const got = await call('GET', `/api/blob/${locker.blobId}`)
    expect(got.status).toBe(200)
    expect(got.json?.id).toBe(locker.blobId)
    expect(got.json?.version).toBe(1)
    expect(got.headers.get('cache-control')).toBe('no-store')
    const payload = decrypt(fromBase64Url(got.json?.ciphertext as string), locker.readKey)
    expect(payload.data).toEqual({ content: 'first text' })
  })

  it('accepts a signed update and bumps the version', async () => {
    const locker = await create()
    const put = await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'second text'))
    expect(put.status).toBe(200)
    expect(put.json).toEqual({ id: locker.blobId, version: 2 })

    const got = await call('GET', `/api/blob/${locker.blobId}`)
    expect(got.json?.version).toBe(2)
    expect(decrypt(fromBase64Url(got.json?.ciphertext as string), locker.readKey).data).toEqual({
      content: 'second text',
    })

    const again = await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(3, 'third text'))
    expect(again.status).toBe(200)
    expect((await call('GET', `/api/blob/${locker.blobId}`)).json?.version).toBe(3)
  })

  it('returns 409 when the id is already taken', async () => {
    const locker = await create()
    const second = await call('POST', '/api/blob', locker.createBody())
    expect(second.status).toBe(409)
  })

  it('an attacker cannot take over an existing id by creating it again', async () => {
    const locker = await create()
    const attacker = deriveKeys(generateSecret())
    const res = await call(
      'POST',
      '/api/blob',
      locker.createBody({ writePublicKey: toBase64Url(attacker.writeKeyPair.publicKey) })
    )
    expect(res.status).toBe(409)
    const ok = await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'still mine'))
    expect(ok.status).toBe(200)
  })

  it('returns 404 for an unknown id (GET and PUT)', async () => {
    const other = newLocker()
    expect((await call('GET', `/api/blob/${other.blobId}`)).status).toBe(404)
    expect((await call('PUT', `/api/blob/${other.blobId}`, other.updateBody(2, 'x'))).status).toBe(404)
  })

  it('health works', async () => {
    const res = await call('GET', '/api/health')
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ status: 'ok' })
  })
})

describe('signature check (401)', () => {
  it('rejects a signature made with another secret', async () => {
    const locker = await create()
    const stranger = deriveKeys(generateSecret())
    const body = locker.updateBody(2, 'evil')
    const blob = fromBase64Url(body.ciphertext)
    body.signature = toBase64Url(signUpdate(locker.blobId, 2, blob, stranger.writeKeyPair.secretKey))
    const res = await call('PUT', `/api/blob/${locker.blobId}`, body)
    expect(res.status).toBe(401)
    expect((await call('GET', `/api/blob/${locker.blobId}`)).json?.version).toBe(1)
  })

  it('rejects a good signature attached to a different ciphertext', async () => {
    const locker = await create()
    const signed = locker.updateBody(2, 'what the owner signed')
    const swapped = locker.updateBody(2, 'what the attacker wants')
    const res = await call('PUT', `/api/blob/${locker.blobId}`, { ...swapped, signature: signed.signature })
    expect(res.status).toBe(401)
  })

  it('rejects a signature that was made for another blob id', async () => {
    const locker = await create()
    const second = await create()
    // Same key material cannot be reused across ids, so sign for the other id with the same key
    const body = locker.updateBody(2, 'x')
    const sig = signUpdate(second.blobId, 2, fromBase64Url(body.ciphertext), locker.writeKeyPair.secretKey)
    const res = await call('PUT', `/api/blob/${locker.blobId}`, { ...body, signature: toBase64Url(sig) })
    expect(res.status).toBe(401)
  })

  it('rejects a signature over a different version', async () => {
    const locker = await create()
    const body = locker.updateBody(3, 'x')
    const res = await call('PUT', `/api/blob/${locker.blobId}`, { ...body, version: 2 })
    expect(res.status).toBe(401)
  })

  it('rejects an all-zero and a flipped signature', async () => {
    const locker = await create()
    const zero = locker.updateBody(2, 'x', { signature: toBase64Url(new Uint8Array(64)) })
    expect((await call('PUT', `/api/blob/${locker.blobId}`, zero)).status).toBe(401)
    const flipped = locker.updateBody(2, 'x')
    const sig = fromBase64Url(flipped.signature)
    sig[0] = (sig[0] ?? 0) ^ 1
    expect((await call('PUT', `/api/blob/${locker.blobId}`, { ...flipped, signature: toBase64Url(sig) })).status).toBe(
      401
    )
  })
})

describe('version check and replay (409)', () => {
  it('rejects a replay of a valid update', async () => {
    const locker = await create()
    const body = locker.updateBody(2, 'v2')
    expect((await call('PUT', `/api/blob/${locker.blobId}`, body)).status).toBe(200)
    const replay = await call('PUT', `/api/blob/${locker.blobId}`, body)
    expect(replay.status).toBe(409)
    expect(replay.json?.currentVersion).toBe(2)
  })

  it('does not let an old signed update overwrite newer content', async () => {
    const locker = await create()
    const old = locker.updateBody(2, 'old')
    expect((await call('PUT', `/api/blob/${locker.blobId}`, old)).status).toBe(200)
    expect((await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(3, 'newer'))).status).toBe(200)
    expect((await call('PUT', `/api/blob/${locker.blobId}`, old)).status).toBe(409)
    const got = await call('GET', `/api/blob/${locker.blobId}`)
    expect(decrypt(fromBase64Url(got.json?.ciphertext as string), locker.readKey).data).toEqual({ content: 'newer' })
  })

  it('rejects the same version as stored, an old one, and a skipped one', async () => {
    const locker = await create()
    expect((await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(1, 'same'))).status).toBe(409)
    expect((await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(3, 'skip'))).status).toBe(409)
    expect((await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'ok'))).status).toBe(200)
    expect((await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'again'))).status).toBe(409)
  })

  it('two valid updates for the same version: exactly one wins', async () => {
    const locker = await create()
    const results = await Promise.all([
      call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'a')),
      call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'b')),
      call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'c')),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
    expect((await call('GET', `/api/blob/${locker.blobId}`)).json?.version).toBe(2)
  })
})

describe('the server holds no key that reads the content', () => {
  it('the stored row contains neither the secret nor the read key', async () => {
    const locker = await create()
    await call('PUT', `/api/blob/${locker.blobId}`, locker.updateBody(2, 'x'))
    const rows = await sql`SELECT * FROM blobs`
    const dump = Buffer.concat(
      rows.flatMap((r) => [Buffer.from(String(r.id)), r.write_public_key, r.ciphertext, Buffer.from(String(r.version))])
    )
    expect(dump.includes(Buffer.from(locker.secret))).toBe(false)
    expect(dump.includes(Buffer.from(locker.readKey))).toBe(false)
    expect(rows[0]?.write_public_key).toEqual(Buffer.from(locker.writeKeyPair.publicKey))
  })

  it('the table has no column that could hold a secret or a read key', async () => {
    const cols =
      await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'blobs' AND table_schema = current_schema()`
    expect(cols.map((c) => c.column_name).sort()).toEqual([
      'ciphertext',
      'created_at',
      'id',
      'updated_at',
      'version',
      'write_public_key',
    ])
  })
})
