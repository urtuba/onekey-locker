import { deriveReadKey } from '@onekey-locker/crypto'
import { useCallback, useEffect, useState } from 'react'
import type { BlobApi } from '../lib/api'
import { baseUrlOf, buildEditUrl, buildViewUrl } from '../lib/fragment'
import { errorMessage, LockerError, type OpenedLocker, openForEdit, saveEdit } from '../lib/locker'
import { EntryEditor, type Row, toRows } from './EntryEditor'
import { EditWarning, QrCodes } from './Result'

export function EditScreen({ api, secret }: { api: BlobApi; secret: Uint8Array }) {
  const [locker, setLocker] = useState<OpenedLocker | undefined>()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setConflict(false)
    setSaved(false)
    try {
      const opened = await openForEdit(api, secret)
      setLocker(opened)
      setRows(toRows(opened.entries))
    } catch (e) {
      setLocker(undefined)
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [api, secret])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!locker) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const next = await saveEdit(api, secret, locker, rows)
      setLocker(next)
      setRows(toRows(next.entries))
      setSaved(true)
    } catch (e) {
      setConflict(e instanceof LockerError && e.code === 'conflict')
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p role="status">Loading and decrypting...</p>

  if (!locker) {
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

  const base = baseUrlOf(window.location)

  return (
    <section className="card">
      <h1>Edit the tag</h1>
      <p>
        You hold the Edit QR. Changes are encrypted here and signed with a key that never leaves this browser. Version{' '}
        {locker.version}, last updated {new Date(locker.updatedAt).toLocaleString()}.
      </p>
      {saved && (
        <div className="alert alert-success" role="status">
          Saved. Everyone who scans the View QR now sees the new content.
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <EntryEditor rows={rows} onChange={setRows} disabled={saving || conflict} />
      <div className="actions">
        {conflict ? (
          <button type="button" className="button" onClick={load}>
            Reload the latest version
          </button>
        ) : (
          <button type="button" className="button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        )}
        <button type="button" className="button button-secondary" onClick={() => setShowQr(!showQr)}>
          {showQr ? 'Hide the QR codes' : 'Show the QR codes'}
        </button>
      </div>
      {showQr && (
        <>
          <EditWarning />
          <QrCodes viewUrl={buildViewUrl(base, deriveReadKey(secret))} editUrl={buildEditUrl(base, secret)} />
        </>
      )}
    </section>
  )
}
