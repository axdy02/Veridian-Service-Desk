# 05 - Security, credentials and failure behaviour

## Signup and sessions
Name: trimmed 2-80 characters. Email: syntactically valid, normalized lower-case, maximum
254 characters; it need not be deliverable because the assessment has no email service.
Password: 12-128 characters; never trim or log it. Use the supplied async scrypt helper
with random salts, fixed parameters, constant-time derived-key comparison. Add rejection
of obviously empty/whitespace-only passwords if desired and test it explicitly.

Use a cryptographically random 32-byte opaque session token; store only SHA-256(token)
in PostgreSQL, not the raw cookie value. Session TTL default 8 hours; validate expiration
on every request. Set cookie HttpOnly, SameSite=Lax, Path=/; Secure=true for HTTPS. In the
explicit local localhost HTTP development mode, Secure=false so login actually works.
Do not accidentally use a __Host- cookie prefix with an insecure local cookie.

Rotate tokens on login, revoke on logout, do not store session tokens in localStorage.
No email verification, external identity provider, password recovery email or real employee
authorization is claimed. Signup creates a private fictional sandbox and nothing more.

## Request protection
Same browser origin via Next rewrite; do not enable wildcard CORS. For state changes require
JSON content type, an exact allowlisted Origin equal to APP_ORIGIN, and `X-VDS-Request: 1`.
Pre-auth signup/login also need this protection. Browser tests and CLI smoke tests must send
these headers. Reject missing/unrecognized origins on mutation routes rather than allowing
cross-site forms. Configure proxy trust deliberately, not `trust proxy=true` universally.
Rate-limit login/signup and agent endpoints by server-validated identity/IP. Suggested demo
limits: 10 authentication attempts / 10 minutes per IP; 30 agent runs / 10 minutes per user,
200/day per user. Label these as prototype cost/abuse controls, not Veridian policy.

Validate length and type of all text, filters, route IDs and JSON. Reject large bodies.
Escape text by normal React rendering. No dangerouslySetInnerHTML or raw HTML rendering of
employee text. Do not expose password hashes, session hashes, cookies, API keys, connection
strings or raw provider exceptions in JSON, logs, screenshots or demo recordings.
A malicious prompt can affect extraction quality; it cannot gain write-tool authority.
User-supplied approval statements are never consumed as verified permission.

## Passcodes and Git hygiene
Do NOT place a real password in README, fixtures, code, .env.example, GitHub Actions or the
Codex final message. scripts/setup.mjs may generate a local reviewer account with a random
32-character passcode, then write it to `private/REVIEWER_CREDENTIALS.txt`, which is ignored.
This file contains local demo credentials and never the Gemini key. Write `.gitignore`
BEFORE creating any private file. Use restrictive file permissions where supported, explain
that Windows ACLs may need user care, and print only the path to the private handoff file.
The user shares that file privately if needed; a public repository does not need a global
password because reviewers can sign up or generate their own local seeded credentials.

Keep the Gemini key ONLY in ignored root `.env` or the launching shell environment. Never
ask the user to paste it into a chat transcript. The browser cannot set arbitrary server-side
model/API credentials. .env.example has blanks and safe placeholders only. Setup preserves
existing .env and credentials; it must not regenerate database passwords against an existing
volume or overwrite a reviewer password without explicit intent.

Suggested ignored entries:
```
node_modules/
.next/
dist/
.env
.env.*
!.env.example
private/
**/*CREDENTIALS*.txt
!private-handoff/CREDENTIALS_TEMPLATE.txt
playwright-report/
test-results/
*.log
```
Do not ignore the required screenshots/report evidence blindly; keep sanitized selected
images under docs/screenshots when needed. Run a tracked-file secret scan before commit.
If a secret was ever committed, removing it from the final tree is not enough: flag it for
rotation and history cleanup. Do not silently publish it.

## Failures and integrity
A missing API key -> visibly labelled offline mode, not a blank page. An invalid key,
unavailable model, timeout, 429 or invalid structured output -> explicit fallback warning.
A missing database -> readiness failure and actionable instructions; do not invent saved
tickets in an in-memory array and pretend PostgreSQL works. A failed ticket write -> no
success statement. Disconnected browser -> persisted run can be inspected after refresh.
A source retrieval failure -> human review, not an answer from ungrounded model memory.
Unknown policy -> say the gap. No guessed deadlines, quota usage, allowance amount or URLs.

## Authentication versus corporate approval
Authentication proves control of a LOCAL DEMO ACCOUNT. It does not prove membership of
Veridian, Finance approval, Security approval, a manager relationship or permission to access
real systems. There is deliberately no 'make myself an admin' toggle or 'approve replacement'
action. Human handoffs remain pending and locally recorded in the demonstration.
