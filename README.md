<p align="center"><img src="assets/logo-wide.png" alt="OneKey Locker" width="420"></p>

# OneKey Locker

> January 2026 side project, finished in a small scope in October 2026; runs locally, not hosted. The January state is tagged [`original-2026`](https://github.com/urtuba/onekey-locker/tree/original-2026).

## The idea

**An updatable QR tag: print it once, change it forever.**

Think of a pet's collar tag or a luggage tag with your contact details. You write the details once and get two QR codes:

- **View QR.** Print it on the tag. Anyone who scans it reads the content.
- **Edit QR.** Keep it safe. Only its holder can change the content, so the printed tag can stay the same while the phone number, the address or the note changes.

The browser encrypts the content before it leaves. The server stores ciphertext only and can never read it.

## How the keys work

The owner has one random 32-byte `secret`. Everything else is derived from it, with SHA-512 and a different prefix for each purpose:

```
secret (32 random bytes) ---------------------------------> Edit QR   (#e/<secret>)
  |
  |-- SHA-512("onekey-locker/read/v1" || secret)[0:32] ----> readKey   View QR   (#v/<readKey>)
  |                                                           encrypts the content (nacl.secretbox)
  |                                                             |
  |                                                             '-- SHA-512("onekey-locker/id/v1" || readKey)[0:16]
  |                                                                 -> blobId (names the blob)
  |
  '-- SHA-512("onekey-locker/write/v1" || secret)[0:32] ---> Ed25519 seed -> write key pair
                                                              only the public key goes to the server
```

- **The server stores:** the blob id, the ciphertext, the Ed25519 public key and a version number. None of them leads to the read key or the secret.
- **A viewer** has only the read key. It is enough to compute the blob id, fetch the ciphertext and decrypt it. It cannot sign an update.
- **An update is signed, never authenticated with a secret.** The client signs `"onekey-locker/update/v1" || blobId || newVersion || SHA-512(newBlob)`. The server checks the signature with the stored public key and requires `newVersion = storedVersion + 1`, so an old request cannot be replayed.
- **The keys live in the URL fragment** (the part after `#`). Browsers never send the fragment to a server, so a key is not in any request or server log. The QR codes encode these links.

The details, with the exact byte layouts, are in [`packages/crypto`](packages/crypto/README.md).

## Design review

Looking back at the January design in October 2026, one flaw stood out.

**The 2026-01 flaw: the write path broke zero-knowledge.** The read key was a hash of the owner's private key, and the API was meant to receive the private key (an `X-Priv-Key` header) to authorize updates. A server that sees the private key can compute the read key and decrypt every locker. The "server cannot read your data" promise was not true. The private draft of the API (`one-key-locker`) did exactly this.

**The fix:**

- The read key, the blob id and the write key are now independent values, derived with domain-separated hashes. Knowing one does not give another.
- Updates are Ed25519 signatures. The server holds only a public key, so it has no secret that could decrypt anything, and no reusable write secret either.
- A signed update names the blob, the new version and the hash of the new content. Replays and stale updates fail on the version.
- The keys are in the URL fragment only.

Problems in the draft that are fixed as well:

| Problem in the draft | Now |
|---|---|
| The API build failed on strict type errors; `npm test` picked up a script | Strict TypeScript, typecheck in CI |
| Any string was accepted as a blob | Strict base64url, size 41 bytes to 16 KB, blob version byte 1 |
| The policy name `"constructor"` crashed the server (500) | Policies are gone; every bad input is a 400 |
| Clients chose paid tiers themselves | No tiers, no billing |
| No API or client tests | 120 API tests (real Postgres), 35 client tests |
| The server listened on all interfaces; `HOST` was ignored | Binds to `HOST`, default `127.0.0.1` |

Other known weaknesses are in [SECURITY.md](SECURITY.md).

## What is in the repository

| Part | What it is |
|---|---|
| [`packages/crypto`](packages/crypto) | Key derivation, encryption (`nacl.secretbox`), signed updates, strict base64url. tweetnacl. 52 tests (jest). |
| [`packages/api`](packages/api) | The blob API: Hono and the `postgres` driver. One table; the ciphertext is stored as `bytea`. 120 tests (vitest) against a real PostgreSQL. |
| [`packages/client`](packages/client) | The web client: React and Vite. Templates (pet tag, contact card, note), the two QR codes, view and edit screens. Content is shown as text only. 35 tests (vitest). |
| `docker-compose.yml` | Postgres, the API and the client (built and served by nginx). |

The API, in short:

| Request | Result |
|---|---|
| `POST /api/blob` with `id`, `ciphertext`, `writePublicKey` | 201 `{id, version: 1}`; 409 if the id is taken |
| `GET /api/blob/:id` | 200 `{id, ciphertext, version, createdAt, updatedAt}`; 404 if unknown |
| `PUT /api/blob/:id` with `ciphertext`, `version`, `signature` | 200 `{id, version}`; 401 bad signature; 409 wrong version |
| bad input (not base64url, wrong length, wrong blob version, too large, unknown or missing fields, bad id) | 400 with a message |
| any other route | 404 |

The JSON body is limited to 32 KB, a blob to 16 KB. Binary values are base64url without padding. See the tests in [`packages/api/test`](packages/api/test) for every case.

## Running it

You need Docker with Compose.

```
docker compose up --build
```

Then open <http://127.0.0.1:8080>. The services listen on `127.0.0.1` only: the client on 8080, the API on 3001, and Postgres on 54320 (change them with `CLIENT_PORT`, `API_PORT` and `POSTGRES_PORT`). The API creates its table when it starts. Data lives in the `pg_data` volume; `docker compose down -v` deletes it.

To develop without Docker you need Node 22 and a Postgres:

```
npm ci
npm run build -w @onekey-locker/crypto
export DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/dbname
npm run dev -w @onekey-locker/api      # http://127.0.0.1:3001
npm run dev -w @onekey-locker/client   # http://127.0.0.1:3000, proxies /api to the API
```

The API settings are `DATABASE_URL` (required), `HOST` (default `127.0.0.1`), `PORT` (default 3001) and `CORS_ORIGINS` (comma-separated; empty means same-origin only).

## Running the tests

```
npm ci
npm run lint            # Biome: lint and format
npm run typecheck       # builds the crypto package, then typechecks every package
npm run test:crypto     # jest
npm run test:client     # vitest
npm run test:api        # vitest; needs a real PostgreSQL, see below
npm run build
```

The API tests need `DATABASE_URL`. Each run creates its own schema and drops it afterwards, so a database with other data is safe. The easiest source is the compose Postgres:

```
docker compose up -d postgres
DATABASE_URL=postgresql://onekey:onekey@127.0.0.1:54320/onekey_locker npm run test:api
```

Jest runs the crypto tests, and vitest runs the API and client tests. Vitest runs TypeScript and ESM with no extra setup and shares the Vite config of the client. Moving the crypto tests to it was not worth the churn.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of this on Node 22, with a Postgres service container for the API tests.

`npm audit` reports 20 moderate advisories, all through one package (`sprintf-js`, used by the Jest tooling). They are in test tooling only. `npm audit --omit=dev` reports none.

## Known limitations

- **No rate limits and no accounts.** Anyone who can reach the API can store as much as they like, 16 KB at a time.
- **A lost Edit QR is lost for good.** There is no recovery. The content stays as it is, forever. There is also no way to delete a locker.
- **The View QR cannot be revoked.** Anyone who has it can read the current content. Changing the content does not change the link.
- **The server sees metadata:** the size of the content, the creation and update times, how many times it changed, and the IP addresses of the requests.
- **First come, first served ids.** Creating a locker is not signed. Ids come from the read key, so nobody can guess one, but the server cannot check that the id belongs to the key pair behind it.
- **The server also serves the client.** Whoever runs the server can serve a changed client that steals the keys. Zero-knowledge holds against a server that only stores data, not against one that ships the code.
- **Links in browser history, bookmarks and screenshots are keys.**
- **The layout is not covered by automated tests.** It is built mobile first for 375 px; the screen tests run in jsdom, which has no layout.

## Why it is not hosted

There is no hosted instance, on purpose. With no accounts and no rate limits, a public instance would be free storage for anyone, and a server that cannot read its data cannot moderate it either. A lost Edit QR cannot be fixed by support. Running it for other people would need rate limits, abuse handling and a privacy policy first. Until then it is something you run yourself, on your own machine.

## License

[AGPL-3.0](LICENSE).
