export interface Config {
  host: string
  port: number
  databaseUrl: string
  corsOrigins: string[]
}

/** Read the settings from environment variables. Throws a clear error on bad values. */
export const loadConfig = (env: Record<string, string | undefined> = process.env): Config => {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('DATABASE_URL is required, for example postgresql://user:pass@127.0.0.1:5432/db')

  const portText = env.PORT?.trim() || '3001'
  const port = Number(portText)
  if (!/^\d+$/.test(portText) || port < 1 || port > 65535) throw new Error(`PORT must be 1-65535, got "${portText}"`)

  const corsOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return { host: env.HOST?.trim() || '127.0.0.1', port, databaseUrl, corsOrigins }
}
