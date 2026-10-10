import { MAX_BLOB_BYTES, MAX_VERSION, MIN_BLOB_BYTES, toBase64Url } from '@onekey-locker/crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, newLocker, setupDatabase, sql } from './helpers.js'

beforeEach(setupDatabase)
afterAll(async () => {
  await sql.end({ timeout: 5 })
})

const blobOf = (length: number, firstByte = 1) => {
  const bytes = new Uint8Array(length).fill(7)
  bytes[0] = firstByte
  return toBase64Url(bytes)
}

describe('POST /api/blob: every invalid input is a 400 with a message, never a 500', () => {
  const locker = newLocker()
  const good = locker.createBody()

  const cases: Array<[string, unknown]> = [
    ['body is not JSON', '{not json'],
    ['body is empty', ''],
    ['body is a JSON array', '[]'],
    ['body is JSON null', 'null'],
    ['body is a JSON string', '"constructor"'],
    ['body is a number', '42'],
    ['body is an empty object', {}],
    ['id is missing', { ciphertext: good.ciphertext, writePublicKey: good.writePublicKey }],
    ['ciphertext is missing', { id: good.id, writePublicKey: good.writePublicKey }],
    ['writePublicKey is missing', { id: good.id, ciphertext: good.ciphertext }],
    ['unknown field', { ...good, policy: 'default' }],
    ['unknown field "constructor"', { ...good, constructor: 'x' }],
    ['unknown field "__proto__" (own property)', JSON.stringify(good).replace('{', '{"__proto__":{"a":1},')],
    ['unknown field "toString"', { ...good, toString: 'x' }],
    ['id "constructor"', { ...good, id: 'constructor' }],
    ['id "__proto__"', { ...good, id: '__proto__' }],
    ['id "!!!"', { ...good, id: '!!!' }],
    ['id too short (21 characters)', { ...good, id: good.id.slice(0, 21) }],
    ['id too long (23 characters)', { ...good, id: `${good.id}A` }],
    ['id with padding characters', { ...good, id: `${good.id.slice(0, 20)}==` }],
    ['id with a slash', { ...good, id: `${good.id.slice(0, 21)}/` }],
    ['id with non-canonical last character', { ...good, id: `${'A'.repeat(21)}B` }],
    ['id is a number', { ...good, id: 1234567890123456 }],
    ['id is an object', { ...good, id: {} }],
    ['id is null', { ...good, id: null }],
    ['ciphertext "constructor"', { ...good, ciphertext: 'constructor' }],
    ['ciphertext "!!!"', { ...good, ciphertext: '!!!' }],
    ['ciphertext with padding', { ...good, ciphertext: `${blobOf(42).slice(0, -2)}==` }],
    ['ciphertext with standard base64 characters', { ...good, ciphertext: `${blobOf(42).slice(0, -3)}+/A` }],
    ['ciphertext not canonical', { ...good, ciphertext: `${blobOf(43).slice(0, -1)}B` }],
    ['ciphertext empty', { ...good, ciphertext: '' }],
    ['ciphertext is a number', { ...good, ciphertext: 1 }],
    ['ciphertext is an array', { ...good, ciphertext: [] }],
    ['ciphertext shorter than the minimum', { ...good, ciphertext: blobOf(MIN_BLOB_BYTES - 1) }],
    ['ciphertext larger than 16 KB', { ...good, ciphertext: blobOf(MAX_BLOB_BYTES + 1) }],
    ['ciphertext with blob version 0', { ...good, ciphertext: blobOf(60, 0) }],
    ['ciphertext with blob version 2', { ...good, ciphertext: blobOf(60, 2) }],
    ['writePublicKey "constructor"', { ...good, writePublicKey: 'constructor' }],
    ['writePublicKey "!!!"', { ...good, writePublicKey: '!!!' }],
    ['writePublicKey 31 bytes', { ...good, writePublicKey: toBase64Url(new Uint8Array(31)) }],
    ['writePublicKey 33 bytes', { ...good, writePublicKey: toBase64Url(new Uint8Array(33)) }],
    ['writePublicKey is null', { ...good, writePublicKey: null }],
  ]

  for (const [name, body] of cases) {
    it(`400: ${name}`, async () => {
      const res = await call('POST', '/api/blob', body)
      expect(res.status).toBe(400)
      expect(typeof res.json?.error).toBe('string')
      expect((await sql`SELECT count(*)::int AS n FROM blobs`)[0]?.n).toBe(0)
    })
  }

  it('400: body over 32 KB', async () => {
    const res = await call('POST', '/api/blob', { ...good, ciphertext: 'A'.repeat(40_000) })
    expect(res.status).toBe(400)
    expect(res.json?.error).toMatch(/at most 32768 bytes/)
  })

  it('accepts a blob of exactly the minimum and the maximum size', async () => {
    const min = newLocker()
    expect((await call('POST', '/api/blob', min.createBody({ ciphertext: blobOf(MIN_BLOB_BYTES) }))).status).toBe(201)
    const max = newLocker()
    expect((await call('POST', '/api/blob', max.createBody({ ciphertext: blobOf(MAX_BLOB_BYTES) }))).status).toBe(201)
    const got = await call('GET', `/api/blob/${max.blobId}`)
    expect(got.status).toBe(200)
    expect(String(got.json?.ciphertext).length).toBe(Math.ceil((MAX_BLOB_BYTES * 4) / 3))
  })
})

describe('GET /api/blob/:id: bad ids are 400', () => {
  const bad = [
    'constructor',
    '__proto__',
    'toString',
    '%21%21%21',
    'a'.repeat(21),
    'a'.repeat(23),
    `${'A'.repeat(21)}B`,
    `${'A'.repeat(20)}%3D%3D`,
    `${'A'.repeat(21)}%2F`,
    `${'A'.repeat(21)}%00`,
    '%E2%82%AC'.repeat(7),
  ]
  for (const id of bad) {
    it(`400: ${id}`, async () => {
      const res = await call('GET', `/api/blob/${id}`)
      expect(res.status).toBe(400)
      expect(typeof res.json?.error).toBe('string')
    })
  }
})

describe('PUT /api/blob/:id: every invalid input is a 400', () => {
  const locker = newLocker()
  const good = locker.updateBody(2, 'new')
  const path = `/api/blob/${locker.blobId}`

  const cases: Array<[string, unknown]> = [
    ['body is not JSON', 'nope'],
    ['body is a JSON array', '[]'],
    ['body is empty', ''],
    ['ciphertext is missing', { version: 2, signature: good.signature }],
    ['version is missing', { ciphertext: good.ciphertext, signature: good.signature }],
    ['signature is missing', { ciphertext: good.ciphertext, version: 2 }],
    ['unknown field', { ...good, writePublicKey: toBase64Url(new Uint8Array(32)) }],
    ['unknown field "constructor"', { ...good, constructor: 'x' }],
    ['version is a string', { ...good, version: '2' }],
    ['version is "constructor"', { ...good, version: 'constructor' }],
    ['version is 0', { ...good, version: 0 }],
    ['version is negative', { ...good, version: -1 }],
    ['version is 1.5', { ...good, version: 1.5 }],
    ['version is too large', { ...good, version: MAX_VERSION + 1 }],
    ['version is null', { ...good, version: null }],
    ['version is an array', { ...good, version: [2] }],
    ['ciphertext "!!!"', { ...good, ciphertext: '!!!' }],
    ['ciphertext "constructor"', { ...good, ciphertext: 'constructor' }],
    ['ciphertext too short', { ...good, ciphertext: blobOf(MIN_BLOB_BYTES - 1) }],
    ['ciphertext over 16 KB', { ...good, ciphertext: blobOf(MAX_BLOB_BYTES + 1) }],
    ['ciphertext with wrong blob version byte', { ...good, ciphertext: blobOf(60, 9) }],
    ['signature "!!!"', { ...good, signature: '!!!' }],
    ['signature "constructor"', { ...good, signature: 'constructor' }],
    ['signature 63 bytes', { ...good, signature: toBase64Url(new Uint8Array(63)) }],
    ['signature 65 bytes', { ...good, signature: toBase64Url(new Uint8Array(65)) }],
    ['signature is a number', { ...good, signature: 5 }],
    ['body over 32 KB', { ...good, ciphertext: 'A'.repeat(40_000) }],
  ]

  for (const [name, body] of cases) {
    it(`400: ${name}`, async () => {
      expect((await call('POST', '/api/blob', locker.createBody())).status).toBe(201)
      const res = await call('PUT', path, body)
      expect(res.status).toBe(400)
      expect(typeof res.json?.error).toBe('string')
      expect((await call('GET', path)).json?.version).toBe(1)
    })
  }

  it('400 for a bad id, even before looking at the body', async () => {
    expect((await call('PUT', '/api/blob/constructor', good)).status).toBe(400)
    expect((await call('PUT', '/api/blob/!!!', good)).status).toBe(400)
  })

  it('400 (not 404) for a bad body on an unknown id', async () => {
    expect((await call('PUT', `/api/blob/${newLocker().blobId}`, { nope: 1 })).status).toBe(400)
  })
})

describe('unknown routes and methods are 404', () => {
  const routes: Array<[string, string]> = [
    ['GET', '/'],
    ['GET', '/api'],
    ['GET', '/api/nope'],
    ['GET', '/api/blob'],
    ['PUT', '/api/blob'],
    ['DELETE', '/api/blob/AAAAAAAAAAAAAAAAAAAAAA'],
    ['PATCH', '/api/blob/AAAAAAAAAAAAAAAAAAAAAA'],
    ['POST', '/api/blob/AAAAAAAAAAAAAAAAAAAAAA'],
    ['GET', '/api/blob/AAAAAAAAAAAAAAAAAAAAAA/extra'],
    ['GET', '/api/health/extra'],
    ['POST', '/api/health'],
    ['GET', '/constructor'],
    ['GET', '/__proto__'],
  ]
  for (const [method, path] of routes) {
    it(`404: ${method} ${path}`, async () => {
      const res = await call(method, path)
      expect(res.status).toBe(404)
      expect(res.json?.error).toBe('not found')
    })
  }
})
