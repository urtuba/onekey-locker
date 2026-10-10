import { useEffect, useMemo, useState } from 'react'
import { CreateScreen } from './components/CreateScreen'
import { EditScreen } from './components/EditScreen'
import { ViewScreen } from './components/ViewScreen'
import { type BlobApi, httpApi } from './lib/api'
import { parseFragment } from './lib/fragment'

const useHash = (): string => {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export function App({ api = httpApi }: { api?: BlobApi }) {
  const hash = useHash()
  const route = useMemo(() => parseFragment(hash), [hash])

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <a className="brand" href={`${window.location.pathname}#`}>
            OneKey Locker
          </a>
          <span className="tagline">An updatable QR tag</span>
        </div>
      </header>

      <main className="container main">
        {route.kind === 'create' && <CreateScreen api={api} />}
        {route.kind === 'view' && <ViewScreen key={hash} api={api} readKey={route.readKey} />}
        {route.kind === 'edit' && <EditScreen key={hash} api={api} secret={route.secret} />}
        {route.kind === 'invalid' && (
          <section className="card">
            <h1>This link is not valid</h1>
            <p>It is incomplete or damaged. Scan the QR code again, or copy the whole link.</p>
            <a className="button" href={`${window.location.pathname}#`}>
              Create a new tag
            </a>
          </section>
        )}
      </main>

      <footer className="footer container">
        <p>
          Your content is encrypted in this browser. The server stores ciphertext only. Keys live in the link after the
          # sign, which browsers never send.
        </p>
      </footer>
    </div>
  )
}
