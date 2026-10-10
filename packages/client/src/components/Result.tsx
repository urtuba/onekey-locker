import { QrCard } from './QrCard'

interface Props {
  viewUrl: string
  editUrl: string
}

/** Both QR codes with the warning about the edit code. Used after creating and when editing. */
export function QrCodes({ viewUrl, editUrl }: Props) {
  return (
    <div className="qr-grid">
      <QrCard
        tone="view"
        title="View QR"
        description="Print this on the tag. Anyone who scans it can read the content."
        url={viewUrl}
        filename="onekey-view-qr.png"
      />
      <QrCard
        tone="edit"
        title="Edit QR"
        description="Keep this private. It is the only way to change the content."
        url={editUrl}
        filename="onekey-edit-qr.png"
      />
    </div>
  )
}

export function EditWarning() {
  return (
    <div className="alert alert-warning" role="note">
      <strong>Save the Edit QR now.</strong> It is the only way to change this content, and it cannot be recovered. We
      do not store it and cannot reset it. If you lose it, the tag stays as it is, forever. Anyone who has the Edit QR
      can read and change the content.
    </div>
  )
}

interface CreatedProps extends Props {
  onAnother: () => void
}

export function CreatedScreen({ viewUrl, editUrl, onAnother }: CreatedProps) {
  return (
    <section className="card">
      <h1>Your tag is ready</h1>
      <EditWarning />
      <QrCodes viewUrl={viewUrl} editUrl={editUrl} />
      <p className="hint">
        Both links are only in this page. If you close it before saving them, you cannot get them back.
      </p>
      <div className="actions no-print">
        <button type="button" className="button" onClick={() => window.print()}>
          Print the QR codes
        </button>
        <button type="button" className="button button-secondary" onClick={onAnother}>
          Create another tag
        </button>
      </div>
    </section>
  )
}
