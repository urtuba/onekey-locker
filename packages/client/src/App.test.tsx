// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { createLocker, openForEdit, saveEdit } from './lib/locker'
import { createFakeApi } from './testing/fakeApi'

// jsdom has no canvas. Record what would be encoded, return a fixed image.
const qrUrls: string[] = []
vi.mock('qrcode', () => ({
  default: {
    toDataURL: async (url: string) => {
      qrUrls.push(url)
      return 'data:image/png;base64,AAAA'
    },
  },
}))

const go = (hash: string) => {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const fragmentOf = (url: string) => new URL(url).hash

beforeEach(() => {
  qrUrls.length = 0
  window.location.hash = ''
})
afterEach(cleanup)

describe('create screen', () => {
  it('creates a pet tag and shows both QR codes with the warning', async () => {
    const { api, seen } = createFakeApi()
    render(<App api={api} />)

    fireEvent.click(screen.getByRole('button', { name: /Pet tag/ }))
    fireEvent.change(screen.getByLabelText('Field 1 value'), { target: { value: 'Max' } })
    fireEvent.change(screen.getByLabelText('Field 4 value'), { target: { value: '+1 555 0123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create the tag' }))

    await screen.findByRole('heading', { name: 'Your tag is ready' })
    expect(screen.getByText(/only way to change this content, and it cannot be recovered/)).toBeTruthy()
    expect(await screen.findByAltText('QR code: View QR')).toBeTruthy()
    expect(await screen.findByAltText('QR code: Edit QR')).toBeTruthy()

    // The QR codes carry the keys in the fragment, never in the path or the query.
    await waitFor(() => expect(qrUrls).toHaveLength(2))
    const [viewUrl, editUrl] = qrUrls as [string, string]
    expect(fragmentOf(viewUrl)).toMatch(/^#v\/[A-Za-z0-9_-]{43}$/)
    expect(fragmentOf(editUrl)).toMatch(/^#e\/[A-Za-z0-9_-]{43}$/)
    expect(new URL(viewUrl).search).toBe('')
    // Nothing the browser sent to the server contains the content or the keys.
    const sent = JSON.stringify(seen)
    expect(sent).not.toContain('Max')
    expect(sent).not.toContain(fragmentOf(viewUrl).slice(3))
    expect(sent).not.toContain(fragmentOf(editUrl).slice(3))
  })

  it('does not create an empty tag', async () => {
    const { api, store } = createFakeApi()
    render(<App api={api} />)
    fireEvent.click(screen.getByRole('button', { name: /Note/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create the tag' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/at least one field/)
    expect(store.size).toBe(0)
  })

  it('shows the server error when creating fails', async () => {
    const { api } = createFakeApi()
    const failing = { ...api, create: async () => Promise.reject(new Error('boom')) }
    render(<App api={failing} />)
    fireEvent.click(screen.getByRole('button', { name: /Contact card/ }))
    fireEvent.change(screen.getByLabelText('Field 1 value'), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create the tag' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/server had a problem/)
  })
})

describe('view and edit screens', () => {
  const setup = async (entries = [{ k: 'Name', v: 'Max' }]) => {
    const fake = createFakeApi()
    const locker = await createLocker(fake.api, entries)
    const { toBase64Url } = await import('@onekey-locker/crypto')
    return {
      ...fake,
      locker,
      viewHash: `#v/${toBase64Url(locker.readKey)}`,
      editHash: `#e/${toBase64Url(locker.secret)}`,
    }
  }

  it('shows the content from a view link', async () => {
    const { api, viewHash } = await setup([
      { k: 'Name', v: 'Max' },
      { k: 'Phone', v: '+1 555 0123' },
    ])
    go(viewHash)
    render(<App api={api} />)
    expect(await screen.findByText('Max')).toBeTruthy()
    expect(screen.getByText('+1 555 0123')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull()
  })

  it('renders the content as text, never as HTML', async () => {
    const evil = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script><b>bold</b>'
    const { api, viewHash } = await setup([{ k: '<i>label</i>', v: evil }])
    go(viewHash)
    const { container } = render(<App api={api} />)
    expect(await screen.findByText(evil)).toBeTruthy()
    expect(screen.getByText('<i>label</i>')).toBeTruthy()
    expect(container.querySelector('.entries img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('.entries b, .entries i')).toBeNull()
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined()
  })

  it('shows an error for a link that points to nothing', async () => {
    const { api } = createFakeApi()
    go(`#v/${'A'.repeat(43)}`)
    render(<App api={api} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/No locker exists/)
  })

  it('shows an error for a malformed link', () => {
    const { api } = createFakeApi()
    go('#v/short')
    render(<App api={api} />)
    expect(screen.getByRole('heading', { name: 'This link is not valid' })).toBeTruthy()
  })

  it('edits and saves from an edit link; the view link shows the change', async () => {
    const { api, editHash, viewHash } = await setup()
    go(editHash)
    render(<App api={api} />)
    const value = await screen.findByLabelText('Field 1 value')
    fireEvent.change(value, { target: { value: 'Rex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect((await screen.findByRole('status')).textContent).toMatch(/Saved/)

    cleanup()
    go(viewHash)
    render(<App api={api} />)
    expect(await screen.findByText('Rex')).toBeTruthy()
  })

  it('shows "changed elsewhere, reload" on a conflict, and reload brings the latest version', async () => {
    const { api, editHash, locker } = await setup()
    go(editHash)
    render(<App api={api} />)
    const value = await screen.findByLabelText('Field 1 value')

    // Someone else saves first.
    const other = await openForEdit(api, locker.secret)
    await saveEdit(api, locker.secret, other, [{ k: 'Name', v: 'Changed elsewhere' }])

    fireEvent.change(value, { target: { value: 'My edit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed somewhere else/)

    fireEvent.click(screen.getByRole('button', { name: 'Reload the latest version' }))
    await waitFor(() =>
      expect((screen.getByLabelText('Field 1 value') as HTMLInputElement).value).toBe('Changed elsewhere')
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the edit screen can show both QR codes again', async () => {
    const { api, editHash } = await setup()
    go(editHash)
    render(<App api={api} />)
    await screen.findByLabelText('Field 1 value')
    fireEvent.click(screen.getByRole('button', { name: 'Show the QR codes' }))
    const cards = await screen.findAllByRole('img')
    expect(within(document.body).getAllByRole('img')).toHaveLength(cards.length)
    await waitFor(() => expect(qrUrls.length).toBe(2))
    expect(
      qrUrls
        .map(fragmentOf)
        .map((f) => f.slice(0, 3))
        .sort()
    ).toEqual(['#e/', '#v/'])
  })
})
