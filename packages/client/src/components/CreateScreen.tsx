import { useState } from 'react'
import type { BlobApi } from '../lib/api'
import { baseUrlOf, buildEditUrl, buildViewUrl } from '../lib/fragment'
import { createLocker, errorMessage } from '../lib/locker'
import { TEMPLATES, type Template, templateEntries, validateEntries } from '../lib/templates'
import { EntryEditor, type Row, toRows } from './EntryEditor'
import { CreatedScreen } from './Result'

interface Created {
  viewUrl: string
  editUrl: string
}

export function CreateScreen({ api }: { api: BlobApi }) {
  const [template, setTemplate] = useState<Template | undefined>()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Created | undefined>()

  const choose = (t: Template) => {
    setTemplate(t)
    setRows(toRows(templateEntries(t), t.fields))
    setError('')
  }

  const reset = () => {
    setTemplate(undefined)
    setRows([])
    setCreated(undefined)
    setError('')
  }

  const submit = async () => {
    const problem = validateEntries(rows)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      const { secret, readKey } = await createLocker(api, rows)
      const base = baseUrlOf(window.location)
      setCreated({ viewUrl: buildViewUrl(base, readKey), editUrl: buildEditUrl(base, secret) })
      setRows([])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (created) return <CreatedScreen {...created} onAnother={reset} />

  if (!template) {
    return (
      <section className="card">
        <h1>Print it once. Change it forever.</h1>
        <p>
          Make a QR tag for a pet collar or a suitcase. Anyone who scans it sees your details. Only you can change them
          later, with a second QR code. The content is encrypted here, in your browser, so the server cannot read it.
        </p>
        <h2>Start from a template</h2>
        <div className="templates">
          {TEMPLATES.map((t) => (
            <button type="button" key={t.id} className="template" onClick={() => choose(t)}>
              <strong>{t.name}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="card">
      <h1>{template.name}</h1>
      <p>Fill in what a person who finds the tag should see. Empty fields are left out.</p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <EntryEditor rows={rows} onChange={setRows} disabled={busy} />
      <div className="actions">
        <button type="button" className="button" onClick={submit} disabled={busy}>
          {busy ? 'Encrypting and saving...' : 'Create the tag'}
        </button>
        <button type="button" className="button button-secondary" onClick={reset} disabled={busy}>
          Back
        </button>
      </div>
    </section>
  )
}
