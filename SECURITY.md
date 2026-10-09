# Security Policy

OneKey Locker was stopped after its first day of work (January 2026) and is archived. It was never deployed, and no version is supported. Do not use it to store real secrets.

If you still find something worth reporting, email **samed@drumbeats.io** rather than opening a public issue.

## Known weaknesses

- **The planned write path breaks zero-knowledge.** The read key is a hash of the private key, and the API was meant to receive the private key (`X-Priv-Key`) to authorize updates. A server that sees the private key can derive the read key and decrypt the data. See "Design review" in the [README](README.md#design-review) for the fix.
- **Lost keys cannot be recovered.** There is no key escrow or recovery passphrase.
- **The server would see metadata:** blob size, creation time, blob ID and access patterns.
- **No forward secrecy:** a leaked read key exposes every version of the content.
