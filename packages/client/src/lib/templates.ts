import type { Payload } from '@onekey-locker/crypto'

export interface Entry {
  k: string
  v: string
}

export interface Field {
  label: string
  placeholder: string
  multiline?: boolean
}

export type TemplateId = 'pet' | 'contact' | 'note'

export interface Template {
  id: TemplateId
  name: string
  description: string
  fields: Field[]
}

export const MAX_ENTRIES = 30
export const MAX_LABEL_LENGTH = 60
export const MAX_VALUE_LENGTH = 2000

export const TEMPLATES: Template[] = [
  {
    id: 'pet',
    name: 'Pet tag',
    description: 'A collar tag: who the pet is and who to call.',
    fields: [
      { label: 'Name', placeholder: 'Max' },
      { label: 'Species', placeholder: 'Dog, cat...' },
      { label: 'Owner', placeholder: 'Your name' },
      { label: 'Phone', placeholder: '+1 555 0123' },
      { label: 'Email', placeholder: 'you@example.com' },
      { label: 'Notes', placeholder: 'Friendly. Needs daily medication.', multiline: true },
    ],
  },
  {
    id: 'contact',
    name: 'Contact card',
    description: 'A luggage tag or a card: how to reach you.',
    fields: [
      { label: 'Name', placeholder: 'Jane Smith' },
      { label: 'Phone', placeholder: '+1 555 0456' },
      { label: 'Email', placeholder: 'jane@example.com' },
      { label: 'Message', placeholder: 'If found, please call or write. Reward offered.', multiline: true },
    ],
  },
  {
    id: 'note',
    name: 'Note',
    description: 'Free text under a title.',
    fields: [
      { label: 'Title', placeholder: 'A title' },
      { label: 'Note', placeholder: 'Write anything.', multiline: true },
    ],
  },
]

export const getTemplate = (id: string): Template | undefined => TEMPLATES.find((t) => t.id === id)

/** Empty entries with the template's labels. */
export const templateEntries = (template: Template): Entry[] => template.fields.map((f) => ({ k: f.label, v: '' }))

/** Trim labels and values, drop rows that have no value. */
export const cleanEntries = (entries: Entry[]): Entry[] =>
  entries.map((e) => ({ k: e.k.trim(), v: e.v.trim() })).filter((e) => e.v !== '')

/** Returns an error message, or undefined if the entries can be saved. */
export const validateEntries = (entries: Entry[]): string | undefined => {
  const cleaned = cleanEntries(entries)
  if (cleaned.length === 0) return 'Fill in at least one field.'
  if (cleaned.length > MAX_ENTRIES) return `Use at most ${MAX_ENTRIES} fields.`
  if (cleaned.some((e) => e.k.length > MAX_LABEL_LENGTH))
    return `A label can have at most ${MAX_LABEL_LENGTH} characters.`
  if (cleaned.some((e) => e.v.length > MAX_VALUE_LENGTH))
    return `A value can have at most ${MAX_VALUE_LENGTH} characters.`
  return undefined
}

/** The encrypted content. All templates produce key/value entries. */
export const entriesToPayload = (entries: Entry[], createdAt: number, updatedAt: number): Payload => ({
  v: 1,
  t: createdAt,
  u: updatedAt,
  type: 'kv',
  data: { entries: cleanEntries(entries) },
})

/** Read any payload type as entries to show or edit. The content is only ever shown as text. */
export const payloadToEntries = (payload: Payload): Entry[] => {
  if (payload.type === 'kv') return (payload.data as { entries: Entry[] }).entries.map((e) => ({ k: e.k, v: e.v }))
  const content = (payload.data as { content: unknown }).content
  if (payload.type === 'text') return [{ k: 'Note', v: String(content) }]
  return [{ k: 'Data', v: JSON.stringify(content, null, 2) ?? '' }]
}
