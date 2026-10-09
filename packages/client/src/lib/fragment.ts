import { fromBase64Url, READ_KEY_BYTES, SECRET_BYTES, toBase64Url } from '@onekey-locker/crypto'

/**
 * The keys travel only in the URL fragment (the part after #). Browsers never send the
 * fragment to a server, so the server does not see a key even in its access logs.
 *
 *   view link:  <app url>#v/<readKey, base64url>
 *   edit link:  <app url>#e/<secret,  base64url>
 */
export type Route =
  | { kind: 'create' }
  | { kind: 'view'; readKey: Uint8Array }
  | { kind: 'edit'; secret: Uint8Array }
  | { kind: 'invalid' }

const INVALID: Route = { kind: 'invalid' }

const decodeKey = (text: string, length: number): Uint8Array | undefined => {
  try {
    const bytes = fromBase64Url(text)
    return bytes.length === length ? bytes : undefined
  } catch {
    return undefined
  }
}

/** Turn `location.hash` into a route. Anything that is not exactly a valid link is `invalid`. */
export const parseFragment = (hash: string): Route => {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (fragment === '' || fragment === '/') return { kind: 'create' }

  const match = /^([ve])\/([A-Za-z0-9_-]+)$/.exec(fragment)
  if (!match) return INVALID
  const [, mode, key] = match

  if (mode === 'v') {
    const readKey = decodeKey(key as string, READ_KEY_BYTES)
    return readKey ? { kind: 'view', readKey } : INVALID
  }
  const secret = decodeKey(key as string, SECRET_BYTES)
  return secret ? { kind: 'edit', secret } : INVALID
}

export const buildViewUrl = (baseUrl: string, readKey: Uint8Array): string => `${baseUrl}#v/${toBase64Url(readKey)}`

export const buildEditUrl = (baseUrl: string, secret: Uint8Array): string => `${baseUrl}#e/${toBase64Url(secret)}`

/** The page address without query and fragment, so a link can be built on top of it. */
export const baseUrlOf = (location: Pick<Location, 'origin' | 'pathname'>): string =>
  `${location.origin}${location.pathname}`
