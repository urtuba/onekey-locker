import { randomBytes } from 'node:crypto'
import postgres from 'postgres'

/**
 * The API tests run against a real PostgreSQL given by DATABASE_URL.
 * Each run uses its own schema and drops it at the end, so existing data is never touched.
 */
export default async function setup() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The API tests need a real PostgreSQL, ' +
        'for example: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm run test -w @onekey-locker/api'
    )
  }
  const schema = `okl_test_${randomBytes(6).toString('hex')}`
  const admin = postgres(url, { max: 1, onnotice: () => {} })
  await admin.unsafe(`CREATE SCHEMA ${schema}`)
  await admin.end()
  process.env.OKL_TEST_SCHEMA = schema

  return async () => {
    const cleanup = postgres(url, { max: 1, onnotice: () => {} })
    await cleanup.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await cleanup.end()
  }
}
