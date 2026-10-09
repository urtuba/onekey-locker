# Security Policy

OneKey Locker is a January 2026 side project, finished in a small scope in October 2026. It runs locally and is not hosted: there is no service to attack and no version is formally supported. It has had no independent security review. Do not use it for anything that matters.

If you find something worth reporting, email **samed@drumbeats.io** rather than opening a public issue.

## What the design protects

The server stores ciphertext, the blob id, an Ed25519 public key and a version number. It never receives the secret or the read key, so it cannot read the content, and it cannot be used to forge an update without the edit link. See "How the keys work" in the [README](README.md#how-the-keys-work).

The flaw of the January design (the write path sent the private key to the server, so the server could derive the read key) is fixed. See "Design review" in the [README](README.md#design-review).

## Known weaknesses

- **No rate limits and no accounts.** Anyone who can reach the API can fill the database. This is the main reason it must not be hosted as it is.
- **Lost keys cannot be recovered.** A lost Edit QR means the content can never be changed again. There is no key escrow, no recovery and no way to delete a locker.
- **The View QR cannot be revoked or rotated.** Anyone who has it can read the current content. A leaked Edit QR gives full control and cannot be replaced.
- **The server sees metadata:** the blob id, the size of the content, creation and update times, the number of versions and the IP address of each request.
- **No forward secrecy:** a leaked read key exposes the current content, and anyone who saved an earlier version still has it.
- **First come, first served ids.** Creating a locker is not signed, so the server cannot check that an id belongs to the key pair that is stored with it. An id cannot be guessed, but it can be taken by someone who knows it.
- **The server also ships the client.** A server that serves a changed client can steal the keys in the browser. Zero-knowledge holds against a server that only stores data, not against one that serves the code.
- **Links are keys.** Browser history, bookmarks, screenshots and shared screens can expose them.
- **Cryptography is not audited.** It uses tweetnacl (XSalsa20-Poly1305, Ed25519, SHA-512) with a small key-derivation scheme designed for this project.
- **Development dependencies:** `npm audit` reports 20 moderate advisories, all through `sprintf-js` in the Jest tooling. Production dependencies have none.
