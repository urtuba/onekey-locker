import { toBase64Url } from '@onekey-locker/crypto'
import { describe, expect, it } from 'vitest'
import { baseUrlOf, buildEditUrl, buildViewUrl, parseFragment } from './fragment'

const key = new Uint8Array(32).map((_, i) => i + 1)
const keyText = toBase64Url(key)

describe('parseFragment', () => {
  it('an empty fragment is the create screen', () => {
    for (const hash of ['', '#', '#/']) expect(parseFragment(hash)).toEqual({ kind: 'create' })
  })

  it('reads a view link', () => {
    expect(parseFragment(`#v/${keyText}`)).toEqual({ kind: 'view', readKey: key })
  })

  it('reads an edit link', () => {
    expect(parseFragment(`#e/${keyText}`)).toEqual({ kind: 'edit', secret: key })
  })

  it('accepts a fragment without the leading #', () => {
    expect(parseFragment(`v/${keyText}`)).toEqual({ kind: 'view', readKey: key })
  })

  it('rejects everything else', () => {
    const bad = [
      '#x/abc',
      '#v',
      '#v/',
      `#v/${keyText}/more`,
      `#v/${keyText}x`, // 44 characters: wrong length
      `#e/${keyText.slice(1)}`, // 42 characters
      `#v/${keyText.slice(0, 42)}B`, // 43 characters, not canonical
      `#v/${keyText}=`,
      `#v/${keyText.slice(0, 40)}!!!`,
      `#V/${keyText}`,
      `#v/${toBase64Url(new Uint8Array(31))}`,
      `#e/${toBase64Url(new Uint8Array(33))}`,
      '#constructor',
      '#__proto__',
      `#/v/${keyText}`, // an extra leading slash is not the format
      `#v/${keyText}?x=1`,
      '#v/%41%41',
    ]
    for (const hash of bad) expect(parseFragment(hash)).toEqual({ kind: 'invalid' })
  })
})

describe('building links', () => {
  it('puts the key after the # sign, never in the path or query', () => {
    const base = baseUrlOf({ origin: 'https://tag.example', pathname: '/app/' })
    expect(base).toBe('https://tag.example/app/')
    const view = buildViewUrl(base, key)
    const edit = buildEditUrl(base, key)
    expect(view).toBe(`https://tag.example/app/#v/${keyText}`)
    expect(edit).toBe(`https://tag.example/app/#e/${keyText}`)
    expect(new URL(view).pathname + new URL(view).search).toBe('/app/')
    expect(new URL(view).hash).toBe(`#v/${keyText}`)
  })

  it('round-trips through parseFragment', () => {
    const view = new URL(buildViewUrl('https://x.test/', key))
    expect(parseFragment(view.hash)).toEqual({ kind: 'view', readKey: key })
    const edit = new URL(buildEditUrl('https://x.test/', key))
    expect(parseFragment(edit.hash)).toEqual({ kind: 'edit', secret: key })
  })
})
