# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

Send an email to **samed@drumbeats.io** (or your email) with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### What to Expect

- **Response time:** Within 48 hours
- **Status update:** Within 7 days
- **Fix timeline:** 30 days for critical issues, 90 days for non-critical

### Disclosure Policy

- We will acknowledge receipt within 72 hours
- We will provide a detailed response within 7 days
- We will work with you to understand and resolve the issue
- We will publicly disclose the issue after a fix is released
- We will credit you in the disclosure (unless you prefer anonymity)

### Scope

**In scope:**
- Cryptographic implementation flaws
- Authentication/authorization bypasses
- Data leakage vulnerabilities
- SQL injection, XSS, CSRF
- API security issues

**Out of scope:**
- Social engineering attacks
- Physical attacks on infrastructure
- DDoS attacks
- Issues in dependencies (report to upstream)

## Security Best Practices

### For Self-Hosters
- Keep your version up-to-date
- Use HTTPS with valid certificates
- Set strong database passwords
- Regular database backups
- Monitor logs for suspicious activity

### For Users
- Never share your private key
- Store keys securely (password manager)
- Verify QR codes before scanning

## Security Features

- **Zero-knowledge architecture:** Server never sees plaintext
- **Client-side encryption:** Data encrypted before leaving browser
- **No key escrow:** Lost keys cannot be recovered
- **Open source:** Full code audit available

## Known Limitations

- **Key loss is permanent:** No recovery mechanism - A recovery passpharase option on cosideration
- **Server knows access patterns:** When/how often blobs are accessed
- **Metadata not encrypted:** Blob size, creation time, blobId
- **No forward secrecy:** Compromised key exposes all historical data