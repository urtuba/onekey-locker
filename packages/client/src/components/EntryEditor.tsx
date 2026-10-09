import { type Entry, type Field, MAX_ENTRIES, MAX_LABEL_LENGTH, MAX_VALUE_LENGTH } from '../lib/templates'

export interface Row extends Entry {
  id: number
  placeholder?: string
  multiline?: boolean
}

let nextId = 1

export const toRows = (entries: Entry[], fields: Field[] = []): Row[] =>
  entries.map((entry, index) => ({
    id: nextId++,
    k: entry.k,
    v: entry.v,
    placeholder: fields[index]?.placeholder,
    multiline: fields[index]?.multiline ?? entry.v.includes('\n'),
  }))

export const newRow = (): Row => ({ id: nextId++, k: '', v: '', multiline: true })

interface Props {
  rows: Row[]
  onChange: (rows: Row[]) => void
  disabled?: boolean
}

/** Label and value inputs. Everything is plain text. */
export function EntryEditor({ rows, onChange, disabled }: Props) {
  const update = (id: number, patch: Partial<Entry>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  return (
    <div className="rows">
      {rows.map((row, index) => (
        <div className="row" key={row.id}>
          <input
            className="input row-label"
            type="text"
            aria-label={`Field ${index + 1} label`}
            placeholder="Label"
            maxLength={MAX_LABEL_LENGTH}
            value={row.k}
            disabled={disabled}
            onChange={(e) => update(row.id, { k: e.target.value })}
          />
          {row.multiline ? (
            <textarea
              className="input row-value"
              aria-label={`Field ${index + 1} value`}
              placeholder={row.placeholder ?? 'Value'}
              maxLength={MAX_VALUE_LENGTH}
              rows={3}
              value={row.v}
              disabled={disabled}
              onChange={(e) => update(row.id, { v: e.target.value })}
            />
          ) : (
            <input
              className="input row-value"
              type="text"
              aria-label={`Field ${index + 1} value`}
              placeholder={row.placeholder ?? 'Value'}
              maxLength={MAX_VALUE_LENGTH}
              value={row.v}
              disabled={disabled}
              onChange={(e) => update(row.id, { v: e.target.value })}
            />
          )}
          <button
            type="button"
            className="button button-quiet"
            aria-label={`Remove field ${index + 1}`}
            disabled={disabled}
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button button-secondary"
        disabled={disabled || rows.length >= MAX_ENTRIES}
        onClick={() => onChange([...rows, newRow()])}
      >
        Add a field
      </button>
    </div>
  )
}
