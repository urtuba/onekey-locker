import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Sql } from './db.js'
import { blobRoutes } from './routes/blob.js'
import { healthRoutes } from './routes/health.js'

export interface AppOptions {
  sql: Sql
  /** Allowed browser origins. Empty means no CORS headers (same-origin only). */
  corsOrigins?: string[]
}

export const createApp = ({ sql, corsOrigins = [] }: AppOptions) => {
  const app = new Hono()

  app.use('*', secureHeaders({ referrerPolicy: 'no-referrer' }))
  if (corsOrigins.length > 0) {
    app.use(
      '/api/*',
      cors({
        origin: corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
        maxAge: 86400,
      })
    )
  }

  app.route('/api/health', healthRoutes(sql))
  app.route('/api/blob', blobRoutes(sql))

  app.notFound((c) => c.json({ error: 'not found' }, 404))
  app.onError((error, c) => {
    console.error('Unhandled error:', error)
    return c.json({ error: 'internal server error' }, 500)
  })

  return app
}
