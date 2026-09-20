# 07 - Verification and delivery gates

## Preparation already completed
The provided dependency-free policy/auth kernel has 72 passing Node tests in the preparation
environment (Node 22.16.0). This is not a claim that the finished web app, PostgreSQL adapter,
LangGraph packages or live Gemini were tested. integration-templates are not a finished app.
Codex must run the integration and browser checks below on the actual implementation.

## Development sequence and checkpoints
1. Inventory existing files; do not overwrite this pack or any unrelated project. Establish
   .gitignore, root workspace, environment preflight and exact dependency lockfile.
2. Run the supplied kernel suite first. Preserve all 25 source cases and 72 tests.
3. Start isolated PostgreSQL, apply migration, seed policies, implement signup/session/workspace
   isolation. Verify login, logout and a private case query before adding the agent UI.
4. Compile a minimal LangGraph + ChatGoogle adapter import/schema smoke test. Implement scoped
   repositories, bounded graph, exact sources, atomic ticket/audit persistence and fallback.
5. Build the defined UI and prove one vertical path: signup -> REQ-02 analysis -> citation
   -> persisted answer after refresh. Then the conflict, Security and multi-turn paths.
6. Run source-fixture regression, database/auth/API tests, Playwright and production build.
7. Finish README, architecture, assumptions, AI disclosure, test report, demo script, safe
   credentials handoff and GitHub-ready commit. No slide/presentation work is part of coding.

Do not repeatedly replan or ask the user to select a framework. Use the specification.
Allocate effort to implementation and test repair, not speculative extras or parallel
branches that rewrite the same files. Save progress after each working vertical slice.

## Required root commands
- `npm run setup`: after clone and cd, checks Node + available PostgreSQL option, initializes
  ignored local env/credentials without overwriting them, installs locked deps, starts isolated
  database, migrates/seeds, and starts the app or prints the exact next command on a real blocker.
  Node and Docker/local PostgreSQL are prerequisites, not magically bundled in a GitHub repo.
- `npm run doctor`: safe config/runtime checks, no secret output.
- `npm run dev`: starts both apps with consistent env and cleans up only its own processes.
- `npm run db:migrate`, `npm run db:seed`: repeatable and non-destructive.
- `npm run check`: typecheck, lint, domain/unit/API tests and production build. Also expose
  browser tests separately if a headed browser cannot be used by the check command.
- `npm run test:e2e`: Playwright using fake-provider/offline mode and a dedicated test database.
- `npm run smoke:gemini`: OPT-IN test only; actual configured key and model, no secret echo.
- `npm run scan:secrets`: inspect tracked deliverable files, fail on actual credentials.

Use cross-platform Node scripts, not Bash-only `export`, rm, cp, background `&` or Unix-specific
path assumptions in npm scripts. Detect occupied ports; do not kill someone else's processes.
Never `docker compose down -v` against an existing project. A fresh test database must be
explicitly isolated and named with a test suffix; never wipe the user's working data.

## Tests to implement beyond the supplied kernel
### Data/database
All seed counts match. Seed rerun duplicates nothing. Original source snapshots/statuses are
unchanged after analysis. Tickets are unique per case; same-key replay creates no duplicate
message/ticket. Same key with changed content returns conflict. Two concurrent runs cannot
both commit a stale version. A failed transaction cannot leave a claimed ticket creation.
Audit UPDATE/DELETE fails. Original six closed records remain inactive and unmodified.
New signup has isolated independent data. Restart preserves accounts, sessions, messages,
tickets and audit. Interrupted runs are shown honestly and can be retried safely.

### Authentication/security
Signup valid/invalid/duplicate, login valid/invalid, logout, expired session, password stored
only as a salt/hash, HttpOnly cookie, local Secure flag correct, rejected external Origin,
missing custom header rejected, no raw HTML execution, oversized input rejection, no unknown
approval fields accepted, no cross-user case/ticket/run/audit access, no client-visible secrets.
Source role/status in a browser payload cannot bypass authorization or close historical cases.

### Agent/API
All 19 active outcomes and 6 closed exclusions match golden data. Source citations resolve to
stored passages. Unknown topic does not invent KB references. Laptop conflict missing one
source fails closed. Existing work stays visible. Failure/429/invalid model JSON is labelled
fallback; no fake live-success badge. Missing database is not disguised as in-memory persistence.
Quoted fact validation and policy invariants hold for model outputs from a mocked provider.
No ID/name-based lookup into golden cases exists in production code.

### Browser
New signup, login/logout, inbox filters, each main page, REQ-02 evidence/no ticket, REQ-01
conflict, REQ-08 preserved Security escalation, REQ-14 follow-up to non-catalog routing,
REQ-05 confirmed resolution, closed-history read-only, audit persistence, second-account
isolation, desktop and mobile sizes, no browser/page console errors. Save sanitized screenshots.

### Live Gemini smoke (only if key available)
Exercise at least a simple guest question, laptop conflict and ambiguous extension follow-up.
Assert accepted fact category and correct kernel decision/source IDs, not exact prose.
Report actual model used and whether requests succeeded. Do not endlessly spend credits on
live tests; automated suites use an injected fake provider. If no key is available, report
live smoke as NOT RUN, and still complete all offline/auth/database/browser tests.

## Completion report
Produce `docs/TEST_REPORT.md` with exact commands, pass/fail/skip counts, environment and any
remaining blockers. Do not mark checks PASS because code looks plausible. Do not omit failing
checks or skip suites to get a green badge. Do not fake screenshots or benchmark percentages.
Inspect npm audit and fix relevant runtime high/critical issues without blindly force-upgrading
packages. Explain any unresolved advisory scope accurately.

Provide root README: problem, scope, quick start, credentials location, API-key instructions,
offline versus live distinction, source-grounding, architecture Mermaid, source conflict demo,
known limitations, author and accurate AI disclosure. Add GitHub CI for keyless checks using
a Postgres service when practical; no user API secret is necessary in the repository.
If GitHub credentials are absent, finish the repository locally and provide exact push steps.
Creating a remote public/private repo is not required to verify the app. Never push secrets.
