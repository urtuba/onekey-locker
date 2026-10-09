import { deriveKeys, encrypt, generateSecret, type Payload, signUpdate, toBase64Url } from '@onekey-locker/crypto'
import { createApp } from '../src/app.js'
import { createSql, migrate } from '../src/db.js'

export const sql = createSql(process.env.DATABASE_URL as string, {
  max: 5,
  connection: { search_path: process.env.OKL_TEST_SCHEMA as string },
})

export const app = createApp({ sql })

export const setupDatabase = async () => {
  await migrate(sql)
  await sql`TRUNCATE blobs`
}

export const call = async (method: string, path: string, body?: unknown) => {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  const res = await app.request(path, init)
  const text = await res.text()
  let json: Record<string, unknown> | undefined
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text, headers: res.headers }
}

/** A client-side locker: what the browser holds, and helpers that build the requests it would send. */
export const newLocker = (content = 'hello') => {
  const secret = generateSecret()
  const keys = deriveKeys(secret)
  const payload = (text: string): Payload => ({ v: 1, t: 1, u: 1, type: 'text', data: { content: text } })
  const blobFor = (text: string) => encrypt(payload(text), keys.readKey)
  const first = blobFor(content)
  return {
    secret,
    ...keys,
    createBody: (overrides: Record<string, unknown> = {}) => ({
      id: keys.blobId,
      ciphertext: toBase64Url(first),
      writePublicKey: toBase64Url(keys.writeKeyPair.publicKey),
      ...overrides,
    }),
    updateBody: (version: number, text: string, overrides: Record<string, unknown> = {}) => {
      const blob = blobFor(text)
      const signature = signUpdate(keys.blobId, version, blob, keys.writeKeyPair.secretKey)
      return { ciphertext: toBase64Url(blob), version, signature: toBase64Url(signature), ...overrides }
    },
  }
}
