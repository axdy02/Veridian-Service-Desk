# Veridian Service Desk - API reference

The Express API is the only component that talks to PostgreSQL, the Gemini SDK and the
LangGraph workflow. The browser talks exclusively to same-origin relative `/api/...` URLs,
which the Next.js route handler proxies to the API server. All responses use a
`{ "data": ... }` envelope on success and `{ "error": { "code", "message", "requestId" } }`
on failure.

## Conventions

- **Authentication** (unless noted): the opaque `vds_session` HttpOnly cookie, backed by a
  hashed server-side session row. Missing/invalid sessions return `401 AUTH_REQUIRED`.
- **Same-origin mutations**: every non-GET request must send `Origin: <app origin>`, the
  `x-vds-request: 1` header and a JSON content type. Otherwise `403 ORIGIN_REJECTED`.
- **Scoping**: every query is scoped by the authenticated workspace; foreign resources
  return `404`, never another tenant's data.
- **Rate limits** (defaults, configurable in `apps/api/src/config.ts`): 10 auth requests and
  30 agent runs per 10 minutes. Exceeding them returns `429 RATE_LIMITED`.
- **Historical cases** (`active = false` or work state CLOSED) refuse every mutation with
  `409 CASE_READ_ONLY`; this is enforced server-side, not only in the UI.

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health/live` | Liveness. Always `200 { status: "live" }` when the process is up. |
| GET | `/api/health/ready` | Readiness. `200` when the initial migration is applied, otherwise `503`. Reports the runtime mode (`offline`/`gemini`) without exposing any secret. |

## Authentication

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{ displayName, email, password }` | Creates the user, a private seeded workspace (all 25 source records) and a session. `201` with the user payload; `409 EMAIL_ALREADY_REGISTERED` on duplicates; `400` on invalid or unknown fields (strict schema, minimum 12-character password). |
| POST | `/api/auth/login` | `{ email, password }` | Rotates sessions (old sessions are revoked), sets the cookie, returns the user payload. `401 INVALID_CREDENTIALS` on failure. |
| POST | `/api/auth/logout` | `{}` | Revokes the session row and clears the cookie. |
| GET | `/api/auth/me` | - | Returns the authenticated user and workspace name. |

## Workspace data

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/api/dashboard` | - | Workspace counts: `total_cases`, `source_requests`, `active_source_tickets`, `closed_historical_tickets`, `actionable_cases`, `processed_cases`, `pending_cases`. |
| GET | `/api/cases` | `limit` (≤100), `offset`, `search`, `sourceType` (`request`/`ticket`/`custom`), `scope` (`actionable`/`history`) | Paginated case summaries; one row is returned beyond the page so the UI can show a load-more control. |
| POST | `/api/cases` | body `{ text }` (3–4000 chars) | Creates a local custom case in the workspace. |
| GET | `/api/cases/:id` | - | Case detail: case record, persisted messages, last decision, local ticket (if any) and the exact stored policy passages for the decision's source IDs. |

## Agent runs

The agent is a LangGraph `StateGraph` (`load_case` → `understand_issue` →
`retrieve_evidence` → `evaluate_policy` → conditional branch → `commit_outcome`). One
`POST` starts a run and returns the finished run (offline mode completes in-process; a
Gemini call carries the configured timeout and no SDK retries).

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/api/cases/:id/analyze` | `{ idempotencyKey, expectedVersion? }` | Runs the workflow on the case's original text. Returns `{ run, replay }`. |
| POST | `/api/cases/:id/messages` | `{ message, idempotencyKey, expectedVersion? }` | Records the employee follow-up as part of a run (bounded recent turns + prior validated facts form the context). |
| GET | `/api/runs/by-key/:key` | - | Returns the persisted run for an idempotency key (used for polling and safe retries). |
| GET | `/api/runs/:id/events` | `after?`, `limit?` | Actual trace events (node started/completed, ticket upserted, run completed) with sequence IDs and durations. No model chain-of-thought is recorded. |

Run semantics:

- `idempotencyKey` (8–128 URL-safe chars) is unique per workspace. Replays with identical
  input return the persisted run (`replay: true`); a different input returns
  `409 IDEMPOTENCY_CONFLICT`.
- `expectedVersion` implements optimistic concurrency; a mismatch returns
  `409 CASE_VERSION_CONFLICT` and never overwrites newer work.
- One running run per case is enforced by a partial unique index; a second concurrent run
  gets `409 CASE_ALREADY_PROCESSING`.
- A failed run never fabricates an outcome: the run row is marked `FAILED`/`CONFLICTED` and
  the response says no outcome was recorded. Runs interrupted by an API restart are marked
  `INTERRUPTED` with code `API_RESTARTED` on startup.

## Knowledge and tickets

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/api/policies` | `q` | Full-text search over the 11 supplied policy passages (PostgreSQL `tsvector`). |
| GET | `/api/policies/:id` | - | One passage with title, exact normalized text, source file, page, section and metadata (authority/issuer/conflict links). |
| GET | `/api/tickets` | `state?`, `limit?` | Workspace tickets: supplied `TK-10xx` source records (immutable status) plus generated local `VDS-` handoffs. |
| GET | `/api/tickets/:id` | - | Ticket detail including the linked case. |

## Audit and settings

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/api/audit` | `caseId?`, `runId?`, `after?`, `limit?` | Append-only audit events ordered by `sequence_id`, scoped to the workspace. The underlying table rejects UPDATE/DELETE at the database level. |
| GET | `/api/settings/runtime` | - | Read-only runtime facts: mode, configured model name and the source version label. No secret values are ever returned. |

## Error codes

`AUTH_REQUIRED` (401), `INVALID_CREDENTIALS` (401), `ORIGIN_REJECTED` (403),
`CASE_NOT_FOUND` / `RUN_NOT_FOUND` / `TICKET_NOT_FOUND` / `POLICY_NOT_FOUND` (404),
`INVALID_INPUT` (400), `EMAIL_ALREADY_REGISTERED` (409), `CASE_READ_ONLY` (409),
`CASE_ALREADY_PROCESSING` (409), `CASE_VERSION_CONFLICT` (409), `IDEMPOTENCY_CONFLICT` (409),
`RATE_LIMITED` (429), `AGENT_RUN_FAILED` (503), `API_PROXY_UNAVAILABLE` / `API_UNREACHABLE`
(503, from the web proxy when the backend is down).
