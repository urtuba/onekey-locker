import { useCallback, useEffect, useState } from 'react'
import type { BlobApi } from '../lib/api'
import { errorMessage, type OpenedLocker, openForView } from '../lib/locker'
import { Entries } from './Entries'

export function ViewScreen({ api, readKey }: { api: BlobApi; readKey: Uint8Array }) {
  const [locker, setLocker] = useState<OpenedLocker | undefined>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLocker(await openForView(api, readKey))
    } catch (e) {
      setLocker(undefined)
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [api, readKey])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p role="status">Loading and decrypting...</p>

  if (error || !locker) {
    return (
      <section className="card">
        <h1>Cannot open this tag</h1>
        <div className="alert alert-error" role="alert">
          {error}
        </div>
        <button type="button" className="button" onClick={load}>
          Try again
        </button>
      </section>
    )
  }

  return (
    <section className="card">
      <h1>Tag</h1>
      <Entries entries={locker.entries} />
      <p className="hint">Last updated {new Date(locker.updatedAt).toLocaleString()}. Decrypted in your browser.</p>
      <div className="actions no-print">
        <button type="button" className="button button-secondary" onClick={load}>
          Reload
        </button>
      </div>
    </section>
  )
}
