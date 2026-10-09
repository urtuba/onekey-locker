import { Hono } from 'hono'
import type { Sql } from '../db.js'

export const healthRoutes = (sql: Sql) => {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      await sql`SELECT 1`
      return c.json({ status: 'ok' })
    } catch (error) {
      console.error('Health check failed:', error)
      return c.json({ status: 'error' }, 503)
    }
  })

  return app
}
