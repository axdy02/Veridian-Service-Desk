# 04 - Database, API and transactional behaviour

Use integration-templates/schema.sql as the initial migration. Adapt names only when
necessary; preserve its keys, cross-workspace constraints and append-only audit semantics.
The migration runner checks schema_migrations before execution; rerunning setup is safe.

## Ownership and seeding
A signup transaction creates user + private workspace + all 25 source cases, and seeds
10 source service-ticket records with their exact TK IDs and initial statuses. The 15
employee requests are case records, not 15 already-created formal tickets. Policy sources
are immutable global reference records. Requests and queue history are cloned per workspace.
All source text, date, original status and source IDs remain separate from current state.

The database does not merge R. Verma with another employee merely because their symptoms
match. Source employee names are fictional content, distinct from the logged-in demo operator.
No action in one account changes another account's data. Every case/message/ticket/audit query
must derive workspaceId from the validated server session; never trust it from the browser.

### State mapping
Preserve source `workState` as supplied in JSON on seeding. Normalized application states
come from the kernel. Store sourceStatus and original snapshot unchanged alongside current
work_state. Keep active=false for the six closed queue records. For new outcomes, ANSWERED
and RESOLVED become non-actionable; all pending/human/needs-information states remain active.
Any employee-confirmed close must record its confirmation basis, not claim external verification.

### Tickets
When serviceTicketRequired=false do not create a ticket. A case and conversation are still
retained for traceability. When true, upsert by (workspace_id,case_id), never append duplicates
on each run. Keep TK-1043/44/47/48 IDs and original source status. A new local ticket gets a
server-generated ID clearly separate from source TK IDs, e.g. `VDS-<short-random-id>`.
Sources/history are stored separately. No fake external ticket URL, SLA or assigned person's
name. Route queue names are application choices: IT, SECURITY, FINANCE, MANAGER, IT_FINANCE,
MANAGER_FINANCE. They are not assertions about an undocumented org chart.

## API contract
All responses use `{data:...}` or `{error:{code,message,requestId}}`. Validate inputs with
Zod, reject unknown dangerous fields, and return structured 400 errors rather than raw stacks.
Mutation requests require same-origin validation and a custom request header.

| Method and path | Contract |
|---|---|
| POST /api/auth/signup | displayName, email, password; creates own workspace, sets session cookie |
| POST /api/auth/login | email, password; generic invalid-credentials error, rotates session |
| POST /api/auth/logout | revoke session in database and expire cookie |
| GET /api/auth/me | safe public user/workspace fields; no hashes, tokens or config secrets |
| GET /api/health/live | process alive; no dependency details or credentials |
| GET /api/health/ready | database/migrations ready; model config status without key |
| GET /api/dashboard | counts computed from this workspace; do not hardcode AI results |
| GET /api/cases | search, source type, status filters; bounded pagination |
| POST /api/cases | create a custom text request, assigned to logged-in sandbox; validated max 4k chars |
| GET /api/cases/:id | source snapshot, current facts/state, conversation, latest outcome |
| POST /api/cases/:id/analyze | idempotency key, optional expectedVersion; analyze supplied text |
| POST /api/cases/:id/messages | message and idempotency key; continue same issue |
| GET /api/runs/by-key/:key | owned run status and safe result; supports polling |
| GET /api/runs/:id/events | owned ordered real trace events; cursor by sequence_id |
| GET /api/policies | optional bounded search; actual source text and page/section |
| GET /api/policies/:id | exact source passage and conflict link |
| GET /api/tickets | own workspace structured tickets; open/history filters |
| GET /api/tickets/:id | own workspace ticket plus its related case and evidence |
| GET /api/audit | owned events, case/run filter, stable cursor pagination |
| GET /api/settings/runtime | redacted runtime mode/model identifier, not environment dump |

Do not add arbitrary status-edit/approval/admin endpoints. Do not expose an endpoint accepting
an arbitrary decision from the client. The server alone executes decide(). Out-of-workspace
record IDs return 404; unauthenticated private routes return 401. Knowledge can be authenticated
as well for consistency. The public signup page can show a short generic sandbox description.

## Idempotency and concurrent work
1. Validate/authenticate before any data read. Canonically hash relevant request inputs.
2. In a short transaction reserve a run with a unique workspace+idempotency key and case
   version. Completed same-key/same-input requests return the stored result. Changed input
   under the same key returns 409. A same-key running request returns 202 with its run ID.
3. A partial unique index permits only one RUNNING run per case. Different simultaneous keys
   should produce a friendly 'already processing' response, not parallel model work.
4. Do NOT keep a database transaction/row lock open while Gemini responds.
5. After the graph's read/extract/decide phases, start a short transaction; update the case
   only where version matches the reserved version. On conflict, roll back state/ticket writes,
   mark the run CONFLICTED, return 409 and let the UI refresh. Do not silently overwrite.
6. Commit case facts, evidence, state, version increment, ticket upsert (if required), final
   assistant message, RUN_COMPLETED audit, and run result atomically. A ticket-created message
   must not be shown before commit actually succeeds.
7. A failed run can retain a redacted user message and honest failure audit; it must not
   fabricate a success reply. Repeating the same key must not duplicate that user message.
8. On a single-instance API restart, mark stale RUNNING runs INTERRUPTED, preserve prior
   messages, append interruption audit, and release the unique-running gate. Do not replay
   writes automatically. The reviewer can retry with a new key. No worker queue is necessary.

## Audit trust level
The SQL trigger prevents ordinary UPDATE/DELETE of audit rows. There is no mutation route.
This is append-only application auditing, not cryptographic tamper-proof storage. A database
administrator can still alter the database; do not claim otherwise. Avoid a destructive reset
button. Reviewers can register a new account for a clean independent dataset.

## Query details
Use pg placeholders (`$1`, `$2`...) and transactions on a single checked-out client. Always
release clients in finally blocks. Parameterize list filters; allowlist any sortable columns.
Use full-text search only for browsing sources, never to manufacture policy authority.
Only return redacted run errors. Keep dates of source events distinct from audit timestamps.

## Repository mapping details
The graph's caseId is the database UUID. The kernel's CaseRecord.id is the source/business
identifier (REQ-01, TK-1043 or the local custom source ID), NOT the UUID. Map loaded records
from source_snapshot plus current database work_state/active/lastReasonCode before calling
decide(). Preserve sourceStatus separately. Gemini allowed evidence texts must include the
current user message, the original issue, and bounded relevant prior USER turns.

REQ-08 is source-escalated/auto-flagged, not explicitly stated to be under investigation.
Its normalized state is SECURITY_ESCALATED. TK-1048 explicitly is under investigation and
uses SECURITY_INVESTIGATION. A new local escalation uses SECURITY_ESCALATED; it must not
claim Security actually started investigating. Source-history counts use immutable source
metadata, not all cases that later became inactive through employee confirmation.
