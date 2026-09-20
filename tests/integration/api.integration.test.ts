/*
 * specs/07 database/auth/API integration tests.
 *
 * Runs the real Express app against an isolated PostgreSQL database whose name carries a
 * `_test` suffix. The database is recreated on every run; the developer's working database
 * is never touched. The agent runs in offline mode so no Gemini credits are spent.
 *
 * Execute with: npm run test:integration
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { after, before, describe, it } from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const adminConfig = {
  host: process.env.POSTGRES_HOST?.trim() || 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432) || 5432,
  user: process.env.POSTGRES_USER?.trim() || 'veridian_local',
  password: process.env.POSTGRES_PASSWORD || undefined,
  database: 'postgres'
};
const testDbName = `${process.env.POSTGRES_DB?.trim() || 'veridian_service_desk'}_test`;
const testConnectionString = `postgresql://${encodeURIComponent(adminConfig.user)}:${encodeURIComponent(adminConfig.password ?? '')}@${adminConfig.host}:${adminConfig.port}/${testDbName}`;
const origin = 'http://localhost:3000';

// Environment must be finalised before the API modules are imported: config.ts reads it once.
process.env.NODE_ENV = 'test';
process.env.AGENT_MODE = 'offline';
process.env.APP_ORIGIN = origin;
process.env.COOKIE_SECURE = 'false';
process.env.DATABASE_URL = testConnectionString;

type TestClient = {
  get(path: string): Promise<{ status: number; body: any }>;
  post(path: string, payload?: unknown): Promise<{ status: number; body: any; setCookie?: string[] }>;
  cookie(): string | undefined;
};

function makeClient(): TestClient {
  let jar: string | undefined;
  const call = async (method: string, path: string, payload?: unknown) => {
    const headers: Record<string, string> = { Origin: origin };
    if (jar) headers.Cookie = jar;
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['x-vds-request'] = '1';
    }
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    const session = setCookie.find((value) => value.startsWith('vds_session='));
    if (session) {
      const raw = session.split(';')[0];
      jar = raw.endsWith('=') ? undefined : raw;
    }
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: response.status, body, setCookie };
  };
  return {
    get: (path) => call('GET', path),
    post: (path, payload) => call('POST', path, payload ?? {}),
    cookie: () => jar
  };
}

let server: Server;
let port = 0;
let pool: Pool;
let admin: Pool;
let clientA: TestClient;
let clientB: TestClient;
let sessionCookieHeader: string | undefined;
let caseBySourceId = new Map<string, { id: string; version: number; active: boolean }>();
let golden: Array<{ caseId: string; expected: Record<string, unknown> }>;
let runCount = 0;
const key = (label: string) => `integration-${label}-${++runCount}`;

async function analyze(sourceId: string, label: string, explicitKey?: string) {
  const target = caseBySourceId.get(sourceId);
  assert.ok(target, `case ${sourceId} should exist in the workspace`);
  // Read the current version so earlier suites' commits do not stale this call.
  const detail = await clientA.get(`/api/cases/${target.id}`);
  assert.equal(detail.status, 200);
  const currentVersion = detail.body.data.case.version as number;
  const idempotencyKey = explicitKey ?? key(label);
  return clientA.post(`/api/cases/${target.id}/analyze`, { idempotencyKey, expectedVersion: currentVersion });
}

before(async () => {
  admin = new Pool(adminConfig);
  await admin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await admin.query(`CREATE DATABASE "${testDbName}"`);
  await admin.end();

  pool = new Pool({ connectionString: testConnectionString });
  const migrationFiles = (await readdir(join(projectRoot, 'migrations'))).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  for (const file of migrationFiles) {
    const sql = await readFile(join(projectRoot, 'migrations', file), 'utf8');
    await pool.query(sql);
  }
  await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", migrationFiles.map((file) => [file]).flat());

  golden = JSON.parse(await readFile(join(projectRoot, 'data/golden-cases.json'), 'utf8'));

  const { createApp } = await import('../../apps/api/src/app.js');
  server = createServer(createApp());
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  port = (server.address() as { port: number }).port;

  clientA = makeClient();
  clientB = makeClient();
  const signupA = await clientA.post('/api/auth/signup', { displayName: 'Integration A', email: 'integration-a@veridian.local', password: 'offline-suite-password-1' });
  assert.equal(signupA.status, 201);
  sessionCookieHeader = signupA.setCookie?.find((value) => value.startsWith('vds_session='));
  const signupB = await clientB.post('/api/auth/signup', { displayName: 'Integration B', email: 'integration-b@veridian.local', password: 'offline-suite-password-2' });
  assert.equal(signupB.status, 201);

  const cases = await clientA.get('/api/cases?limit=100');
  assert.equal(cases.status, 200);
  caseBySourceId = new Map(
    (cases.body.data.items as Array<any>).map((item) => [item.sourceId, { id: item.id, version: item.version, active: item.active }])
  );
  assert.equal(caseBySourceId.size, 25);
});

after(async () => {
  await server?.closeAllConnections?.();
  await new Promise<void>((resolveClose) => server?.close(() => resolveClose()));
  await pool?.end();
  admin = new Pool(adminConfig);
  await admin.query(`DROP DATABASE IF EXISTS "${testDbName}"`).catch(() => undefined);
  await admin.end();
});

describe('authentication and sessions', () => {
  it('rejects unauthenticated workspace access', async () => {
    const anonymous = makeClient();
    const me = await anonymous.get('/api/auth/me');
    assert.equal(me.status, 401);
  });

  it('rejects invalid login credentials', async () => {
    const response = await clientA.post('/api/auth/login', { email: 'integration-a@veridian.local', password: 'definitely-wrong-password' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects duplicate signup and invalid signup input', async () => {
    // Dedicated clients: failed-intent signups must not disturb the main sessions.
    const duplicate = await makeClient().post('/api/auth/signup', { displayName: 'Duplicate', email: 'integration-a@veridian.local', password: 'offline-suite-password-1' });
    assert.equal(duplicate.status, 409);
    const shortPassword = await makeClient().post('/api/auth/signup', { displayName: 'Short', email: 'short@veridian.local', password: 'only-11char' });
    assert.equal(shortPassword.status, 400);
    const unknownField = await makeClient().post('/api/auth/signup', { displayName: 'Injector', email: 'injector@veridian.local', password: 'offline-suite-password-3', role: 'admin' });
    assert.equal(unknownField.status, 400);
  });

  it('rejects mutations without the same-origin proof header', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ email: 'integration-a@veridian.local', password: 'offline-suite-password-1' })
    });
    assert.equal(response.status, 403);
    assert.equal(((await response.json()) as any).error.code, 'ORIGIN_REJECTED');
  });

  it('sets an HttpOnly session cookie and supports logout revocation', async () => {
    assert.ok(sessionCookieHeader, 'signup must set a session cookie');
    assert.match(sessionCookieHeader, /HttpOnly/i, 'session cookie must be HttpOnly');
    assert.match(sessionCookieHeader, /SameSite=Lax/i, 'session cookie must be SameSite=Lax');
    assert.doesNotMatch(sessionCookieHeader, /Secure/i, 'local HTTP sessions must not set the Secure flag');
    const logout = await clientA.post('/api/auth/logout');
    assert.equal(logout.status, 200);
    const afterLogout = await clientA.get('/api/auth/me');
    assert.equal(afterLogout.status, 401);
    const login = await clientA.post('/api/auth/login', { email: 'integration-a@veridian.local', password: 'offline-suite-password-1' });
    assert.equal(login.status, 200);
  });
});

describe('seeded workspace data', () => {
  it('reports the supplied dataset counts', async () => {
    const dashboard = await clientA.get('/api/dashboard');
    assert.equal(dashboard.status, 200);
    const counts = dashboard.body.data.counts;
    assert.equal(counts.source_requests, 15);
    assert.equal(counts.active_source_tickets, 4);
    assert.equal(counts.closed_historical_tickets, 6);
    assert.equal(counts.total_cases, 25);
    assert.equal(counts.pending_cases, 19);
    assert.equal(counts.processed_cases, 0);
  });

  it('creates an isolated private workspace for every signup', async () => {
    const casesB = await clientB.get('/api/cases?limit=100');
    assert.equal(casesB.status, 200);
    const idsB = new Set((casesB.body.data.items as Array<any>).map((item) => item.id));
    const casesA = await clientA.get('/api/cases?limit=100');
    const idsA = (casesA.body.data.items as Array<any>).map((item) => item.id);
    assert.equal(idsB.size, 25);
    assert.ok(idsA.every((id) => !idsB.has(id)), 'the two workspaces must not share case rows');
  });
});

describe('golden case outcomes (offline agent)', () => {
  it('matches every active golden expectation through the real API', async () => {
    const active = golden.filter((entry) => caseBySourceId.get(entry.caseId)?.active);
    assert.equal(active.length, 19);
    for (const entry of active) {
      const response = await analyze(entry.caseId, entry.caseId);
      assert.equal(response.status, 200, `${entry.caseId} analysis should succeed`);
      const run = response.body.data.run;
      assert.equal(run.status, 'COMPLETED', `${entry.caseId} run should complete`);
      const decision = run.result.decision;
      assert.equal(decision.category, entry.expected.category, `${entry.caseId} category`);
      assert.equal(decision.reasonCode, entry.expected.reasonCode, `${entry.caseId} reasonCode`);
      assert.equal(decision.disposition, entry.expected.disposition, `${entry.caseId} disposition`);
      assert.equal(decision.route, entry.expected.route, `${entry.caseId} route`);
      assert.deepEqual(decision.sourceIds, entry.expected.sourceIds, `${entry.caseId} sourceIds`);
      assert.equal(decision.externalActionExecuted, false, `${entry.caseId} must not execute external actions`);
      const expectedTicket = decision.disposition === 'HUMAN_REVIEW' || decision.disposition === 'CONTINUE_EXISTING';
      assert.equal(decision.serviceTicketRequired, expectedTicket, `${entry.caseId} ticket requirement`);
    }
  });

  it('keeps the six closed source records read-only', async () => {
    const closed = golden.filter((entry) => !caseBySourceId.get(entry.caseId)?.active);
    assert.equal(closed.length, 6);
    // Exercised as user B so the shared per-user agent budget of user A is preserved.
    const casesB = await clientB.get('/api/cases?limit=100');
    const closedB = new Map((casesB.body.data.items as Array<any>).map((item) => [item.sourceId, item]));
    for (const entry of closed) {
      const target = closedB.get(entry.caseId);
      assert.ok(target, `${entry.caseId} should exist in workspace B`);
      const response = await clientB.post(`/api/cases/${target.id}/analyze`, { idempotencyKey: key(`${entry.caseId}-closed`), expectedVersion: target.version });
      assert.equal(response.status, 409, `${entry.caseId} is historical and must refuse analysis`);
      assert.equal(response.body.error.code, 'CASE_READ_ONLY');
    }
  });
});

describe('safety-critical behaviours', () => {
  it('records guidance for the guest Wi-Fi question without creating a ticket', async () => {
    const target = caseBySourceId.get('REQ-02');
    const detail = await clientA.get(`/api/cases/${target.id}`);
    assert.equal(detail.body.data.ticket, null);
    assert.equal(detail.body.data.decision.serviceTicketRequired, false);
    assert.ok(detail.body.data.policies.some((policy: any) => policy.id === 'KB-07'));
  });

  it('surfaces the laptop policy conflict with both sources and a local handoff', async () => {
    const target = caseBySourceId.get('REQ-01');
    const detail = await clientA.get(`/api/cases/${target.id}`);
    const decision = detail.body.data.decision;
    assert.deepEqual(decision.conflicts.flatMap((conflict: any) => conflict.sourceIds).sort(), ['ASSET-01', 'KB-03']);
    assert.equal(detail.body.data.ticket === null, false, 'human review must produce a local handoff');
    assert.match(detail.body.data.ticket.displayId, /^VDS-/, 'generated local tickets use VDS ids, not source TK ids');
  });

  it('closes a confirmed self-service issue only after employee confirmation', async () => {
    const target = caseBySourceId.get('REQ-05');
    assert.equal(caseBySourceId.get('REQ-05').active, true);
    const confirmation = await clientA.post(`/api/cases/${target.id}/messages`, {
      message: 'I renewed my VPN credentials and the issue is resolved.',
      idempotencyKey: key('req05-confirm')
    });
    assert.equal(confirmation.status, 200);
    assert.equal(confirmation.body.data.run.status, 'COMPLETED');
    const detail = await clientA.get(`/api/cases/${target.id}`);
    assert.equal(detail.body.data.case.workState, 'RESOLVED');
  });

  it('asks a clarifying question for the unknown browser extension and can continue the conversation', async () => {
    const target = caseBySourceId.get('REQ-14');
    const detail = await clientA.get(`/api/cases/${target.id}`);
    assert.equal(detail.body.data.decision.disposition, 'NEEDS_INFO');
    assert.ok(detail.body.data.decision.questions.length >= 1);
    const reply = await clientA.post(`/api/cases/${target.id}/messages`, {
      message: 'The extension is called FocusTrack and it is not in the software catalog.',
      idempotencyKey: key('req14-followup')
    });
    assert.equal(reply.status, 200);
    const updated = await clientA.get(`/api/cases/${target.id}`);
    assert.equal(updated.body.data.decision.disposition, 'HUMAN_REVIEW');
    assert.equal(updated.body.data.decision.route, 'SECURITY');
  });
});

describe('idempotency and optimistic concurrency', () => {
  it('returns the persisted run for a replayed idempotency key without duplicating work', async () => {
    const targetId = caseBySourceId.get('REQ-09').id;
    const detail0 = await clientA.get(`/api/cases/${targetId}`);
    const version0 = detail0.body.data.case.version as number;
    const sharedBody = { idempotencyKey: key('req09-replay'), expectedVersion: version0 };
    const first = await clientA.post(`/api/cases/${targetId}/analyze`, sharedBody);
    assert.equal(first.status, 200);
    assert.equal(first.body.data.replay, false);
    const detailAfterFirst = await clientA.get(`/api/cases/${targetId}`);
    const userMessagesAfterFirst = (detailAfterFirst.body.data.messages as Array<any>).filter((message) => message.role === 'user').length;
    const replay = await clientA.post(`/api/cases/${targetId}/analyze`, sharedBody);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.replay, true);
    assert.equal(replay.body.data.run.id, first.body.data.run.id);
    const detail = await clientA.get(`/api/cases/${targetId}`);
    const userMessages = (detail.body.data.messages as Array<any>).filter((message) => message.role === 'user').length;
    assert.equal(userMessages, userMessagesAfterFirst, 'a replayed key must not duplicate conversation messages');
  });

  it('rejects a reused idempotency key with different input', async () => {
    const targetId = caseBySourceId.get('REQ-03').id;
    const detail0 = await clientA.get(`/api/cases/${targetId}`);
    const sharedKey = key('req03-conflict');
    const first = await clientA.post(`/api/cases/${targetId}/analyze`, {
      idempotencyKey: sharedKey,
      expectedVersion: detail0.body.data.case.version as number
    });
    assert.equal(first.status, 200);
    const replayed = await clientA.post(`/api/cases/${targetId}/messages`, { message: 'A different payload.', idempotencyKey: sharedKey });
    assert.equal(replayed.status, 409);
    assert.equal(replayed.body.error.code, 'IDEMPOTENCY_CONFLICT');
  });

  it('rejects a stale expected version instead of overwriting newer work', async () => {
    const target = caseBySourceId.get('REQ-06');
    const response = await clientA.post(`/api/cases/${target.id}/analyze`, { idempotencyKey: key('req06-version'), expectedVersion: 999 });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'CASE_VERSION_CONFLICT');
  });
});

describe('workspace isolation and audit integrity', () => {
  it('hides another workspace cases, runs, and audit events', async () => {
    const target = caseBySourceId.get('REQ-01');
    const foreignCase = await clientB.get(`/api/cases/${target.id}`);
    assert.equal(foreignCase.status, 404);

    // User B creates a fresh run in its own workspace; user A must not observe it.
    const casesB = await clientB.get('/api/cases?limit=100');
    const req11B = (casesB.body.data.items as Array<any>).find((item) => item.sourceId === 'REQ-11');
    const requestB = await clientB.post(`/api/cases/${req11B.id}/messages`, {
      message: 'Following up on the contractor VPN access request.',
      idempotencyKey: key('req11-isolation')
    });
    assert.equal(requestB.status, 200);
    const runId = requestB.body.data.run.id as string;
    const foreignRunEvents = await clientA.get(`/api/runs/${runId}/events`);
    assert.equal(foreignRunEvents.status, 404);

    const auditA = await clientA.get('/api/audit?limit=100');
    const eventRuns = (auditA.body.data.items as Array<any>).map((event) => event.runId);
    assert.ok(eventRuns.every((id) => id !== runId), 'user A must not observe user B run events');
  });

  it('keeps audit records append-only at the database level', async () => {
    await assert.rejects(
      () => pool.query("UPDATE audit_events SET event_type = 'TAMPERED' WHERE sequence_id = 1"),
      /append-only/
    );
    await assert.rejects(
      () => pool.query('DELETE FROM audit_events WHERE sequence_id = 1'),
      /append-only/
    );
    const untouched = await pool.query<{ event_type: string }>('SELECT event_type FROM audit_events WHERE sequence_id = 1');
    assert.notEqual(untouched.rows[0].event_type, 'TAMPERED');
  });

  it('persists runs, messages, tickets, and audit events across a fresh connection', async () => {
    const target = caseBySourceId.get('REQ-04');
    const direct = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM runs WHERE workspace_id = (SELECT workspace_id FROM cases WHERE id = $1)', [target.id]);
    assert.ok(Number(direct.rows[0].count) >= 1, 'completed runs must be persisted in PostgreSQL, not memory');
    const audit = await pool.query<{ event_type: string }>(
      'SELECT event_type FROM audit_events WHERE case_id = $1 ORDER BY sequence_id ASC',
      [target.id]
    );
    assert.ok(audit.rows.some((row) => row.event_type === 'RUN_COMPLETED'));
    assert.ok(audit.rows.some((row) => row.event_type === 'TICKET_UPSERTED'));
  });
});
