import { toBase64Url, verifyUpdate } from '@onekey-locker/crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { findBlob, insertBlob, type Sql, updateBlob } from '../db.js'
import { MAX_BODY_BYTES, parseBlobId, parseCreateBody, parseUpdateBody } from '../validate.js'

export const blobRoutes = (sql: Sql) => {
  const app = new Hono()

  // Too-large bodies are rejected before they are read. Like every bad input: 400.
  app.use(
    '*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: `request body must be at most ${MAX_BODY_BYTES} bytes` }, 400),
    })
  )

  /** Read and parse the JSON body. Returns undefined if it is missing or not valid JSON. */
  const readJson = async (req: Request): Promise<unknown> => {
    try {
      return await req.json()
    } catch {
      return undefined
    }
  }

  // POST /api/blob: create a locker. The server cannot derive the id (it would need the read key),
  // so it checks the id's format and that it is unused.
  app.post('/', async (c) => {
    const parsed = parseCreateBody(await readJson(c.req.raw))
    if (!parsed.ok) return c.json({ error: parsed.error }, 400)
    const { id, ciphertext, writePublicKey } = parsed.value

    if (!(await insertBlob(sql, id, writePublicKey, ciphertext))) {
      return c.json({ error: 'a blob with this id already exists' }, 409)
    }
    return c.json({ id, version: 1 }, 201)
  })

  // GET /api/blob/:id: ciphertext and version. The id is the only thing a reader needs.
  app.get('/:id', async (c) => {
    const id = parseBlobId(c.req.param('id'))
    if (!id.ok) return c.json({ error: id.error }, 400)

    const row = await findBlob(sql, id.value)
    if (!row) return c.json({ error: 'blob not found' }, 404)

    c.header('Cache-Control', 'no-store')
    return c.json({
      id: row.id,
      ciphertext: toBase64Url(row.ciphertext),
      version: row.version,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })
  })

  // PUT /api/blob/:id: replace the ciphertext. Authorized by an Ed25519 signature over
  // (id, newVersion, hash of the new blob), never by a secret sent to the server.
  app.put('/:id', async (c) => {
    const id = parseBlobId(c.req.param('id'))
    if (!id.ok) return c.json({ error: id.error }, 400)
    const parsed = parseUpdateBody(await readJson(c.req.raw))
    if (!parsed.ok) return c.json({ error: parsed.error }, 400)
    const { ciphertext, version, signature } = parsed.value

    const row = await findBlob(sql, id.value)
    if (!row) return c.json({ error: 'blob not found' }, 404)

    if (!verifyUpdate(id.value, version, ciphertext, signature, row.write_public_key)) {
      return c.json({ error: 'invalid signature' }, 401)
    }
    // A replayed or stale request carries a valid signature for an old version.
    if (version !== row.version + 1 || !(await updateBlob(sql, id.value, version, ciphertext))) {
      return c.json({ error: 'wrong version: the blob has changed', currentVersion: row.version }, 409)
    }
    return c.json({ id: id.value, version })
  })

  return app
}
