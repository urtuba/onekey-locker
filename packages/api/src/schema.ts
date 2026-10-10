/**
 * The whole database schema. It is applied when the server starts and is safe to apply again.
 *
 * One table. The server stores only ciphertext, the Ed25519 write public key and a version
 * counter. It never holds a key that can read or decrypt the content.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS blobs (
  id               text        PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{22}$'),
  write_public_key bytea       NOT NULL CHECK (octet_length(write_public_key) = 32),
  ciphertext       bytea       NOT NULL CHECK (octet_length(ciphertext) BETWEEN 41 AND 16384),
  version          integer     NOT NULL CHECK (version >= 1),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
)
`
