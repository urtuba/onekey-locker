import postgres from 'postgres'
import { SCHEMA_SQL } from './schema.js'

export type Sql = postgres.Sql

export const createSql = (url: string, options: postgres.Options<Record<string, never>> = {}): Sql =>
  postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10, onnotice: () => {}, ...options })

/** Create the table if it is missing. */
export const migrate = async (sql: Sql): Promise<void> => {
  await sql.unsafe(SCHEMA_SQL)
}

export interface BlobRow {
  id: string
  write_public_key: Buffer
  ciphertext: Buffer
  version: number
  created_at: Date
  updated_at: Date
}

export const findBlob = async (sql: Sql, id: string): Promise<BlobRow | undefined> => {
  const rows = await sql<BlobRow[]>`
    SELECT id, write_public_key, ciphertext, version, created_at, updated_at
    FROM blobs WHERE id = ${id}`
  return rows[0]
}

/** Insert a new blob at version 1. Returns false if the id is already taken. */
export const insertBlob = async (
  sql: Sql,
  id: string,
  writePublicKey: Uint8Array,
  ciphertext: Uint8Array
): Promise<boolean> => {
  const rows = await sql`
    INSERT INTO blobs (id, write_public_key, ciphertext, version)
    VALUES (${id}, ${Buffer.from(writePublicKey)}, ${Buffer.from(ciphertext)}, 1)
    ON CONFLICT (id) DO NOTHING
    RETURNING id`
  return rows.length === 1
}

/**
 * Replace the ciphertext, but only if the stored version is still the one before `newVersion`.
 * The check and the write are one statement, so two racing updates cannot both win.
 */
export const updateBlob = async (
  sql: Sql,
  id: string,
  newVersion: number,
  ciphertext: Uint8Array
): Promise<boolean> => {
  const rows = await sql`
    UPDATE blobs
    SET ciphertext = ${Buffer.from(ciphertext)}, version = ${newVersion}, updated_at = now()
    WHERE id = ${id} AND version = ${newVersion - 1}
    RETURNING id`
  return rows.length === 1
}
