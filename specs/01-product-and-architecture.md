# 01 - Product and architecture

## The product
**Veridian Service Desk**, an individual AIONOS round-two assessment by **Ansh Kapoor**.
Round one used FloodReady. This is a NEW repository; never alter or deploy FloodReady.
Solve Assignment 2 using Veridian Corp's supplied IT-support data only. The user wants
signup/login, PostgreSQL, their familiar JavaScript full-stack approach, Gemini, and
an intentionally designed non-blue interface. GitHub is the requested code delivery;
no paid host, hosted auth, managed database subscription, vector database or paid tracing.

### What counts as complete
A real locally runnable full-stack application, not a static mockup. Authenticated users
can open all supplied cases, ask follow-up questions, run the real LangGraph workflow,
view supporting policy passages, inspect/upsert structured tickets, and inspect actual
recorded audit events. New custom cases use the same logic, not a lookup by request ID.

## Fixed architecture
- `apps/web`: Next.js App Router + TypeScript + React. System fonts; plain CSS or Tailwind
  only if the implementation is already comfortable with it. No required design service.
- `apps/api`: Node.js + Express + TypeScript. All AI, session, database and authorization
  code lives here. The browser cannot call Gemini or the database directly.
- PostgreSQL with the `pg` driver, parameterized SQL, committed SQL migrations. Do not
  add Prisma for this timebox: the reference SQL is already defined and no ORM is needed.
- LangGraph.js for the real workflow, LangChain's maintained `@langchain/google` Gemini
  adapter, `@langchain/core`, Zod for validation. No LangSmith account is required.
- Node built-in `crypto.scrypt` for passwords, random opaque server-side sessions.
- Node built-in test runner for the supplied kernel; API/database integration tests;
  Playwright for browser verification. Use fake provider injection in automated tests.
- npm workspaces, one root lockfile, strict TypeScript, explicit root scripts.

Use a current patched Next.js 16 release and compatible React, Express and LangChain
packages resolved ONCE in the target environment. Check peers and engines, save exact
versions, and commit package-lock.json. Do not use random versions from memory, previews,
`--force`, or `--legacy-peer-deps` to conceal incompatibilities. Support Node 22.16+ in
22.x and current 24.x. Prefer the installed supported LTS version over an OS upgrade.

## Local topology
Browser `http://localhost:3100` -> Next rewrite `/api/*` -> Express `127.0.0.1:3101` ->
PostgreSQL `127.0.0.1:55432` and server-side Gemini. These avoid FloodReady's usual ports.
Use a separate Docker Compose project `veridian-assignment2` and an isolated named volume
for PostgreSQL. No container, port, database or folder belonging to FloodReady may be changed.
Support an existing local PostgreSQL URL as an alternative when Docker is unavailable.

The web app only uses relative `/api/...` URLs. Auth cookies are set through this same-origin
proxy; do not introduce cross-origin credentials or wildcard CORS. Never mix `localhost`
and `127.0.0.1` in browser-visible origins. The internal API address may use 127.0.0.1.

## Repository layout
```
apps/web/                 Next.js UI
apps/api/src/             Express, auth, repositories, graph adapter
reference-core/         supplied kernel, typed declarations and domain tests
data/                    normalized source JSON, source manifest; no credentials
migrations/              versioned PostgreSQL SQL
scripts/                 setup, doctor, migrate, seed, dev, check, smoke, secret scan
specs/                   implementation specification retained for review
docs/                    architecture, assumptions, AI disclosure, demo, test report
assignment-source/       supplied assignment brief and Assignment 2 pack
private/                 ignored local credentials handoff
.env.example             no real secrets
.env                     ignored runtime configuration
compose.yaml
package.json
package-lock.json
README.md
```

## Scope boundaries
Do not implement email delivery, actual network/account unlocks, equipment shipment,
real IT-security approvals, OAuth, SMTP, password-reset email, file upload/OCR, vector
embeddings, WebSockets, autonomous SQL, multi-agent roleplay, or an external search tool.
No billing, paid deployment, cloud signup or AIONOS/FloodReady integration is required.
A forgotten-password email link must not be shown if it is not implemented. For the demo,
a reviewer can simply sign up again with a different address or use their local account.

An authenticated user is a DEMO OPERATOR in their own fictional workspace, not an
administrator of Veridian's real systems. Signing up confers zero policy approval powers.
