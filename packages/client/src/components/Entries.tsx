import type { Entry } from '../lib/templates'

/** The decrypted content. React escapes text, and nothing here sets HTML: the content is only ever text. */
export function Entries({ entries }: { entries: Entry[] }) {
  return (
    <dl className="entries">
      {entries.map((entry, index) => (
        // The list is static and has no stable ids, so the index is the key.
        // biome-ignore lint/suspicious/noArrayIndexKey: static list
        <div className="entry" key={index}>
          {entry.k && <dt>{entry.k}</dt>}
          <dd>{entry.v}</dd>
        </div>
      ))}
    </dl>
  )
}
