import { describe, expect, it } from 'vitest'
import {
  cleanEntries,
  entriesToPayload,
  getTemplate,
  MAX_ENTRIES,
  MAX_LABEL_LENGTH,
  MAX_VALUE_LENGTH,
  payloadToEntries,
  TEMPLATES,
  templateEntries,
  validateEntries,
} from './templates'

describe('templates', () => {
  it('has the pet, contact and note templates', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['pet', 'contact', 'note'])
    expect(getTemplate('pet')?.name).toBe('Pet tag')
    expect(getTemplate('constructor')).toBeUndefined()
  })

  it('each template has distinct, non-empty labels within the limits', () => {
    for (const t of TEMPLATES) {
      const labels = t.fields.map((f) => f.label)
      expect(new Set(labels).size).toBe(labels.length)
      for (const label of labels) {
        expect(label.length).toBeGreaterThan(0)
        expect(label.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH)
      }
      expect(t.fields.length).toBeLessThanOrEqual(MAX_ENTRIES)
    }
  })

  it('templateEntries gives empty values under the template labels', () => {
    const pet = getTemplate('pet')
    expect(pet).toBeDefined()
    const entries = templateEntries(pet as NonNullable<typeof pet>)
    expect(entries.map((e) => e.k)).toContain('Phone')
    expect(entries.every((e) => e.v === '')).toBe(true)
  })

  it('an empty template cannot be saved', () => {
    for (const t of TEMPLATES) expect(validateEntries(templateEntries(t))).toBe('Fill in at least one field.')
  })
})

describe('entries', () => {
  it('cleanEntries trims and drops rows without a value', () => {
    expect(
      cleanEntries([
        { k: ' Name ', v: ' Max ' },
        { k: 'Phone', v: '   ' },
        { k: '', v: 'no label' },
      ])
    ).toEqual([
      { k: 'Name', v: 'Max' },
      { k: '', v: 'no label' },
    ])
  })

  it('validateEntries checks counts and lengths', () => {
    expect(validateEntries([{ k: 'a', v: 'b' }])).toBeUndefined()
    expect(validateEntries(Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => ({ k: `k${i}`, v: 'v' })))).toMatch(
      /at most 30 fields/
    )
    expect(validateEntries([{ k: 'x'.repeat(MAX_LABEL_LENGTH + 1), v: 'v' }])).toMatch(/label/)
    expect(validateEntries([{ k: 'k', v: 'x'.repeat(MAX_VALUE_LENGTH + 1) }])).toMatch(/value/)
  })

  it('markup in values is kept as plain text, not changed', () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>'
    expect(cleanEntries([{ k: 'Note', v: evil }])).toEqual([{ k: 'Note', v: evil }])
  })
})

describe('payload conversion', () => {
  it('round-trips key/value entries', () => {
    const entries = [
      { k: 'Name', v: 'Max' },
      { k: 'Notes', v: 'line 1\nline 2' },
    ]
    const payload = entriesToPayload(entries, 10, 20)
    expect(payload).toEqual({ v: 1, t: 10, u: 20, type: 'kv', data: { entries } })
    expect(payloadToEntries(payload)).toEqual(entries)
  })

  it('shows text and json payloads from other clients as text', () => {
    expect(payloadToEntries({ v: 1, t: 1, u: 1, type: 'text', data: { content: 'hello' } })).toEqual([
      { k: 'Note', v: 'hello' },
    ])
    expect(payloadToEntries({ v: 1, t: 1, u: 1, type: 'json', data: { content: { a: 1 } } })).toEqual([
      { k: 'Data', v: '{\n  "a": 1\n}' },
    ])
  })
})
