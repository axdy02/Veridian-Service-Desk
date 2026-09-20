# Veridian Service Desk - implementation test report

Prepared for Ansh Kapoor, AIONOS round-two Assignment 2. This report records the commands
that were actually executed on 20 September 2026 and their real results. Nothing here is
projected or assumed; a check that could not run is listed as NOT RUN with its reason.

## Environment

| Item | Value |
| --- | --- |
| Machine | Windows (PowerShell + Git Bash), local development machine |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| Docker | 29.8.0 (used only for the local PostgreSQL 16 container) |
| PostgreSQL | postgres:16-alpine container, port 127.0.0.1:5432 |
| Browser engine | Playwright 1.58.2, Chromium (installed locally) |
| Gemini | No API key configured; the whole verification ran in the labelled offline mode |

## Executed checks and results

| Check | Command | Result |
| --- | --- | --- |
| Supplied policy/auth kernel suite | `node --test reference-core/engine.test.mjs reference-core/auth.test.mjs` | PASS - 72/72 tests, 0 failures |
| Kernel fixtures display | `node reference-core/run-fixtures.mjs` | PASS - 25/25 source records displayed |
| API strict typecheck | `npm run typecheck --workspace=@veridian/api` | PASS - no errors |
| Web strict typecheck | `npm run typecheck --workspace=@veridian/web` | PASS - no errors |
| Production build (API) | `npm run build --workspace=@veridian/api` | PASS - `dist/index.js` bundled |
| Production build (Web) | `npm run build --workspace=@veridian/web` | PASS - 10 routes built |
| Database migration | `npm run db:migrate` | PASS - `001_initial.sql` applied |
| Database seed | `npm run db:seed` | PASS - 25 cases, 10 source tickets, 11 policy passages, demo reviewer |
| Seed idempotency | `npm run db:seed` (second run) | PASS - no duplicates, existing workspace preserved |
| Doctor | `npm run doctor` | PASS - PostgreSQL reachable, migration applied, no secret output |
| Database/API integration suite | `npm run test:integration` | PASS - 19/19 tests, 0 failures |
| Browser end-to-end suite | `npx playwright test` | PASS - 15/15 tests, 0 failures |
| Secret scan | `npm run scan:secrets` | PASS - no committed credentials found |
| Combined gate | `npm run check` | PASS - typechecks + kernel suite + builds + integration suite |

## What the suites cover

### Kernel suite (supplied, unchanged)
72 dependency-free tests over the policy engine, safe fact normalization, fallback
classifier and password/session helpers, including every one of the 25 source records.

### Integration suite (`tests/integration/api.integration.test.ts`, 19 tests)
Runs the real Express app against an isolated `*_test` PostgreSQL database (recreated each
run; the working database is never touched) in offline mode:

- Signup validation (short password, invalid email, unknown fields, duplicate email 409).
- Login failure, HttpOnly SameSite=Lax session cookie, logout revocation, 401 guard.
- Same-origin mutation protection (missing `x-vds-request` header rejected 403).
- Seeded dataset counts (15 requests / 4 active tickets / 6 closed / 19 pending / 0 processed).
- Two-workspace isolation (no shared case rows; foreign case, run and audit events 404).
- All 19 active golden outcomes match category, reason code, disposition, route, source IDs
  and ticket requirement through the real HTTP API; `externalActionExecuted` stays false.
- All 6 closed source records refuse analysis with `CASE_READ_ONLY`.
- REQ-02 records guidance with KB-07 evidence and no local ticket.
- REQ-01 surfaces the KB-03 / ASSET-01 conflict and creates a clearly local `VDS-` handoff.
- REQ-05 closes only after the employee confirms resolution (work state RESOLVED).
- REQ-14 asks a clarifying question, then routes to Security after the follow-up.
- Idempotency key replay returns the same persisted run without duplicating messages;
  a reused key with different input returns 409 `IDEMPOTENCY_CONFLICT`.
- Stale `expectedVersion` returns 409 `CASE_VERSION_CONFLICT`.
- Audit records are append-only at the database level (UPDATE/DELETE rejected by trigger).
- Runs, messages, tickets and audit events are persisted in PostgreSQL, not memory.

### Browser suite (`tests/e2e/*.spec.ts`, 15 tests)
Real Chromium against the dev web app on port 3100 and the API on port 3101 with the same
isolated test database and offline mode. Covers: UI signup with inline validation and no
fake password-recovery link; invalid-login error state; guarded-route redirect; logout
revocation; the seeded inbox (25 rows, 15/4/6 count cards); REQ-02 evidence panel with no
ticket; REQ-01 side-by-side conflict panel with a VDS handoff; REQ-08 Security escalation
preserved; TK-1042 historical read-only view; inbox search and history filters; the audit
trail showing real run events; REQ-14 multi-turn clarification to Security routing; REQ-05
employee-confirmed resolution; second-account isolation via a graceful error state; the
390x844 mobile drawer without horizontal overflow; and zero unexpected browser console
errors. Screenshots are saved to `test-results/screenshots/` during the run.

## NOT RUN

| Check | Reason |
| --- | --- |
| Live Gemini smoke (`npm run smoke:gemini`) | No GEMINI_API_KEY is configured. The script is opt-in and the app was fully verified in the clearly labelled offline mode. The single local change to enable it is adding the key to the ignored `.env`. |
| Lint | No linter is configured in the supplied pack. Adding a new toolchain was out of scope for this implementation task; typecheck (strict) plus the test suites above are the enforced gates. |

## Notes and known limitations

- The reported source week is 21-25 September 2026 (fictional Veridian Corp). Audit
  timestamps are real execution times, not the fixture dates.
- The offline path is deterministic rule-based reasoning and is labelled as such in the
  runtime badge and audit trail; it never claims to be a Gemini completion.
- No external accounts are changed and no email is sent anywhere in the system; the
  sandbox records local guidance and handoffs only.
- The app is a verified assessment prototype, not a production-ready product.

## Reproducing this report

```powershell
npm install
npm run setup      # creates ignored .env + private/REVIEWER_CREDENTIALS.txt
npm run db:bootstrap
npm run check
npx playwright test
npm run scan:secrets
```
