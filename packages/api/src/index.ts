import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createSql, migrate } from './db.js'

const main = async () => {
  const config = loadConfig()
  const sql = createSql(config.databaseUrl)
  await migrate(sql)

  const app = createApp({ sql, corsOrigins: config.corsOrigins })
  const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
    console.log(`OneKey Locker API listening on http://${info.address}:${info.port}`)
  })

  const shutdown = () => {
    server.close(() => {
      sql.end({ timeout: 5 }).finally(() => process.exit(0))
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('Failed to start:', error instanceof Error ? error.message : error)
  process.exit(1)
})
