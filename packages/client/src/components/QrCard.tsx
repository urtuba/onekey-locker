import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

interface Props {
  title: string
  description: string
  url: string
  filename: string
  tone?: 'view' | 'edit'
}

export function QrCard({ title, description, url, filename, tone = 'view' }: Props) {
  const [image, setImage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'M' })
      .then((data) => {
        if (!cancelled) setImage(data)
      })
      .catch(() => {
        if (!cancelled) setImage('')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={`qr-card qr-${tone}`}>
      <h2>{title}</h2>
      <p>{description}</p>
      {image ? (
        <img className="qr-image" src={image} alt={`QR code: ${title}`} />
      ) : (
        <div className="qr-image qr-empty" />
      )}
      <div className="qr-actions">
        <button type="button" className="button button-secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {image && (
          <a className="button button-secondary" href={image} download={filename}>
            Download PNG
          </a>
        )}
      </div>
    </section>
  )
}
