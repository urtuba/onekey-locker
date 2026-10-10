import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { sql } from './helpers.js'

describe('loadConfig', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db' }

  it('binds to 127.0.0.1 by default', () => {
    const config = loadConfig(base)
    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(3001)
    expect(config.corsOrigins).toEqual([])
  })

  it('reads HOST, PORT and CORS_ORIGINS', () => {
    const config = loadConfig({ ...base, HOST: '0.0.0.0', PORT: '8080', CORS_ORIGINS: 'http://a.test, http://b.test,' })
    expect(config).toMatchObject({ host: '0.0.0.0', port: 8080, corsOrigins: ['http://a.test', 'http://b.test'] })
  })

  it('requires DATABASE_URL and a sane PORT', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL is required')
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow('PORT must be')
    expect(() => loadConfig({ ...base, PORT: '70000' })).toThrow('PORT must be')
    expect(() => loadConfig({ ...base, PORT: '0' })).toThrow('PORT must be')
  })
})

describe('CORS and headers', () => {
  it('sends no CORS headers when CORS_ORIGINS is empty', async () => {
    const app = createApp({ sql })
    const res = await app.request('/api/health', { headers: { Origin: 'http://evil.test' } })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows only the listed origins', async () => {
    const app = createApp({ sql, corsOrigins: ['http://good.test'] })
    const ok = await app.request('/api/health', { headers: { Origin: 'http://good.test' } })
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://good.test')
    const bad = await app.request('/api/health', { headers: { Origin: 'http://evil.test' } })
    expect(bad.headers.get('access-control-allow-origin')).not.toBe('http://evil.test')
  })

  it('sets safe headers and does not leak the referrer', async () => {
    const res = await createApp({ sql }).request('/api/health')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
  })
})
