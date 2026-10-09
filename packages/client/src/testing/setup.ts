/**
 * Under jsdom, `TextEncoder` returns a Uint8Array from another JavaScript realm, and tweetnacl
 * rejects it (`instanceof Uint8Array` fails). A real browser does not have this problem.
 * This replaces TextEncoder in the tests with one that returns a Uint8Array of the test realm.
 */
class RealmSafeTextEncoder {
  readonly encoding = 'utf-8'
  encode(input = ''): Uint8Array {
    return new Uint8Array(Buffer.from(input, 'utf8'))
  }
}

globalThis.TextEncoder = RealmSafeTextEncoder as unknown as typeof TextEncoder
