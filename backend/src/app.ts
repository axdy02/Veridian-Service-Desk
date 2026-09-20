import { createHash, randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { hashPassword, verifyPassword } from '@veridian/domain/auth';
import { z } from 'zod';
import { appendAudit } from './audit.js';
import { authenticate, clearSessionCookie, createSession, publicActor, requireActor, requireSameOrigin, revokeSession, rotateSessions, setSessionCookie } from './auth.js';
import { config, runtimeMode } from './config.js';
import { databaseReady, isUniqueViolation, query, withTransaction } from './db.js';
import { errorMiddleware, AppError, asyncRoute } from './errors.js';
import { executeAgent, markRunFailed } from './agent.js';
import { createRateLimit, clientAddress } from './rate-limit.js';
import { seedPolicies, seedWorkspace } from './seeding.js';
import type { AuthenticatedRequest, Actor, PublicRun } from './types.js';

const idSchema = z.string().uuid();
const idempotencySchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._-]+$/, 'Use a URL-safe idempotency key.');
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0)
}).strict();
const signupSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128).refine((value) => /\S/.test(value), 'Password cannot be only whitespace.')
}).strict();
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
}).strict();
const customCaseSchema = z.object({ text: z.string().trim().min(3).max(4000) }).strict();
const analyzeSchema = z.object({
  idempotencyKey: idempotencySchema,
  expectedVersion: z.number().int().min(0).optional()
}).strict();
const messageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  idempotencyKey: idempotencySchema,
  expectedVersion: z.number().int().min(0).optional()
}).strict();

type CaseRow = {
  id: string;
  source_id: string;
  source_kind: string;
  source_snapshot: Record<string, unknown>;
  source_status: string | null;
  source_date: string | null;
  employee_name: string | null;
  employee_email: string | null;
  original_text: string;
  work_state: string;
  active: boolean;
  facts: Record<string, unknown>;
  fact_evidence: unknown[];
  last_decision: Record<string, unknown> | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type TicketRow = {
  id: string;
  workspace_id: string;
  case_id: string;
  display_id: string;
  route: string | null;
  state: string;
  original_status: string | null;
  summary: string;
  reason_code: string | null;
  policy_source_ids: string[];
  history_source_ids: string[];
  created_at: Date | string;
  updated_at: Date | string;
  source_id?: string;
  active?: boolean;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapCase(row: CaseRow) {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceKind: row.source_kind,
    sourceSnapshot: row.source_snapshot,
    sourceStatus: row.source_status,
    sourceDate: row.source_date,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    originalText: row.original_text,
    workState: row.work_state,
    active: row.active,
    facts: row.facts ?? {},
    factEvidence: row.fact_evidence ?? [],
    lastDecision: row.last_decision,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapTicket(row: TicketRow) {
  return {
    id: row.id,
    caseId: row.case_id,
    displayId: row.display_id,
    route: row.route,
    state: row.state,
    originalStatus: row.original_status,
    summary: row.summary,
    reasonCode: row.reason_code,
    policySourceIds: row.policy_source_ids ?? [],
    historySourceIds: row.history_source_ids ?? [],
    sourceId: row.source_id,
    active: row.active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapRun(row: {
  id: string;
  status: string;
  agent_mode: string | null;
  result: unknown | null;
  safe_error_code: string | null;
  started_at: Date | string;
  finished_at: Date | string | null;
}): PublicRun {
  return {
    id: row.id,
    status: row.status,
    agentMode: row.agent_mode,
    result: row.result,
    safeErrorCode: row.safe_error_code,
    startedAt: iso(row.started_at) ?? '',
    finishedAt: iso(row.finished_at)
  };
}

function canonicalHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

async function readOwnedCase(actor: Actor, caseId: string): Promise<CaseRow> {
  const result = await query<CaseRow>(
    `SELECT id, source_id, source_kind, source_snapshot, source_status, source_date, employee_name, employee_email,
            original_text, work_state, active, facts, fact_evidence, last_decision, version, created_at, updated_at
     FROM cases WHERE id = $1 AND workspace_id = $2`,
    [caseId, actor.workspaceId]
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'CASE_NOT_FOUND', 'The requested case was not found.');
  return row;
}

async function getOwnedRun(actor: Actor, runId: string): Promise<PublicRun> {
  const result = await query<{
    id: string; status: string; agent_mode: string | null; result: unknown | null; safe_error_code: string | null; started_at: Date | string; finished_at: Date | string | null;
  }>(
    `SELECT id, status, agent_mode, result, safe_error_code, started_at, finished_at
     FROM runs WHERE id = $1 AND workspace_id = $2`,
    [runId, actor.workspaceId]
  );
  if (!result.rows[0]) throw new AppError(404, 'RUN_NOT_FOUND', 'The requested run was not found.');
  return mapRun(result.rows[0]);
}

async function reserveRun(input: {
  actor: Actor;
  caseId: string;
  idempotencyKey: string;
  latestText: string;
  expectedVersion?: number;
  operation: 'analyze' | 'message';
}): Promise<{ run: PublicRun; shouldExecute: boolean }> {
  const inputHash = canonicalHash({ operation: input.operation, caseId: input.caseId, latestText: input.latestText, expectedVersion: input.expectedVersion ?? null });
  return withTransaction(async (client) => {
    const existing = await client.query<{
      id: string; status: string; agent_mode: string | null; result: unknown | null; safe_error_code: string | null; started_at: Date | string; finished_at: Date | string | null; input_hash: string;
    }>(
      `SELECT id, status, agent_mode, result, safe_error_code, started_at, finished_at, input_hash
       FROM runs WHERE workspace_id = $1 AND idempotency_key = $2`,
      [input.actor.workspaceId, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].input_hash !== inputHash) {
        throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This idempotency key was already used with different input.');
      }
      return { run: mapRun(existing.rows[0]), shouldExecute: false };
    }
    const caseResult = await client.query<{ id: string; version: number; active: boolean; work_state: string; original_text: string }>(
      'SELECT id, version, active, work_state, original_text FROM cases WHERE id = $1 AND workspace_id = $2',
      [input.caseId, input.actor.workspaceId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new AppError(404, 'CASE_NOT_FOUND', 'The requested case was not found.');
    if (!caseRow.active || caseRow.work_state === 'CLOSED') {
      throw new AppError(409, 'CASE_READ_ONLY', 'Historical cases are read-only and cannot be analyzed.');
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== caseRow.version) {
      throw new AppError(409, 'CASE_VERSION_CONFLICT', 'This case changed. Refresh it before running analysis.');
    }
    const runId = randomUUID();
    try {
      const inserted = await client.query<{
        id: string; status: string; agent_mode: string | null; result: unknown | null; safe_error_code: string | null; started_at: Date | string; finished_at: Date | string | null;
      }>(
        `INSERT INTO runs (id, workspace_id, case_id, idempotency_key, input_hash, status, case_version)
         VALUES ($1, $2, $3, $4, $5, 'RUNNING', $6)
         RETURNING id, status, agent_mode, result, safe_error_code, started_at, finished_at`,
        [runId, input.actor.workspaceId, input.caseId, input.idempotencyKey, inputHash, caseRow.version]
      );
      await appendAudit(client, {
        workspaceId: input.actor.workspaceId,
        actorUserId: input.actor.userId,
        caseId: input.caseId,
        runId,
        eventType: 'RUN_RESERVED',
        payload: { operation: input.operation, expectedVersion: caseRow.version }
      });
      return { run: mapRun(inserted.rows[0]), shouldExecute: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'CASE_ALREADY_PROCESSING', 'This case is already being analyzed. Wait for the current run to finish.');
      }
      throw error;
    }
  });
}

async function executeReservedRun(input: { actor: Actor; caseId: string; runId: string; latestText: string }): Promise<PublicRun> {
  try {
    await executeAgent(input);
  } catch (error) {
    if (error instanceof AppError && error.code === 'CASE_VERSION_CONFLICT') throw error;
    await markRunFailed({ actor: input.actor, caseId: input.caseId, runId: input.runId, code: 'AGENT_RUN_FAILED' });
    throw new AppError(503, 'AGENT_RUN_FAILED', 'The analysis could not be completed. No outcome was recorded; try again with a new idempotency key.');
  }
  return getOwnedRun(input.actor, input.runId);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((request, response, next) => {
    response.locals.requestId = request.get('X-Request-Id')?.slice(0, 80) || randomUUID();
    response.setHeader('X-Request-Id', response.locals.requestId as string);
    next();
  });

  app.get('/api/health/live', (_request, response) => response.status(200).json({ data: { status: 'live' } }));
  app.get('/api/health/ready', asyncRoute(async (_request, response) => {
    const ready = await databaseReady();
    response.status(ready ? 200 : 503).json({ data: { status: ready ? 'ready' : 'not_ready', database: ready ? 'ready' : 'unavailable', runtimeMode: runtimeMode(), geminiConfigured: Boolean(config.geminiApiKey) } });
  }));

  app.use(express.json({ limit: config.maxJsonBytes, strict: true }));
  app.use('/api', requireSameOrigin);
  const authRateLimit = createRateLimit({ windowMs: config.rateLimits.authWindowMs, max: config.rateLimits.authMax, key: clientAddress });
  const agentRateLimit = createRateLimit({
    windowMs: config.rateLimits.agentWindowMs,
    max: config.rateLimits.agentMax,
    key: (request) => (request as AuthenticatedRequest).actor?.userId ?? clientAddress(request)
  });

  app.post('/api/auth/signup', authRateLimit, asyncRoute(async (request, response) => {
    const input = signupSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    try {
      const session = await withTransaction(async (client) => {
        await seedPolicies(client);
        const userId = randomUUID();
        const workspaceId = randomUUID();
        await client.query(
          'INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)',
          [userId, input.email, input.displayName, passwordHash]
        );
        await client.query('INSERT INTO workspaces (id, owner_user_id, name) VALUES ($1, $2, $3)', [workspaceId, userId, 'Your workspace']);
        await seedWorkspace(client, { workspaceId, ownerUserId: userId });
        await appendAudit(client, { workspaceId, actorUserId: userId, eventType: 'ACCOUNT_CREATED', payload: {} });
        const newSession = await createSession(client, userId);
        return { ...newSession, actor: { userId, workspaceId, email: input.email, displayName: input.displayName } satisfies Actor };
      });
      setSessionCookie(response, session.token, session.expiresAt);
      response.status(201).json({ data: { user: publicActor(session.actor) } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with that email already exists.');
      throw error;
    }
  }));

  app.post('/api/auth/login', authRateLimit, asyncRoute(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const userResult = await query<{ id: string; email: string; display_name: string; password_hash: string; workspace_id: string }>(
      `SELECT u.id, u.email, u.display_name, u.password_hash, w.id AS workspace_id
       FROM users u JOIN workspaces w ON w.owner_user_id = u.id WHERE u.email = $1`,
      [input.email]
    );
    const user = userResult.rows[0];
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const session = await withTransaction(async (client) => {
      const rotated = await rotateSessions(client, user.id);
      await appendAudit(client, { workspaceId: user.workspace_id, actorUserId: user.id, eventType: 'SESSION_CREATED', payload: {} });
      return rotated;
    });
    setSessionCookie(response, session.token, session.expiresAt);
    response.json({ data: { user: publicActor({ userId: user.id, workspaceId: user.workspace_id, email: user.email, displayName: user.display_name }) } });
  }));

  app.post('/api/auth/logout', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    await revokeSession(request);
    await withTransaction((client) => appendAudit(client, { workspaceId: actor.workspaceId, actorUserId: actor.userId, eventType: 'SESSION_REVOKED', payload: {} }));
    clearSessionCookie(response);
    response.json({ data: { loggedOut: true } });
  }));

  app.get('/api/auth/me', authenticate, (request, response) => {
    response.json({ data: { user: publicActor(requireActor(request as AuthenticatedRequest)) } });
  });

  app.get('/api/dashboard', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const counts = await query<{
      total_cases: number; source_requests: number; active_source_tickets: number; closed_historical_tickets: number; actionable_cases: number; processed_cases: number; pending_cases: number;
    }>(
      `SELECT count(*)::int AS total_cases,
        count(*) FILTER (WHERE source_kind = 'request')::int AS source_requests,
        count(*) FILTER (WHERE source_kind = 'ticket' AND active)::int AS active_source_tickets,
        count(*) FILTER (WHERE source_kind = 'ticket' AND NOT active)::int AS closed_historical_tickets,
        count(*) FILTER (WHERE active)::int AS actionable_cases,
        count(*) FILTER (WHERE last_decision IS NOT NULL)::int AS processed_cases,
        count(*) FILTER (WHERE active AND (last_decision IS NULL OR work_state NOT IN ('ANSWERED', 'RESOLVED')))::int AS pending_cases
       FROM cases WHERE workspace_id = $1`,
      [actor.workspaceId]
    );
    response.json({ data: { counts: counts.rows[0] } });
  }));

  app.get('/api/cases', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const pagination = paginationSchema.parse({ limit: request.query.limit, offset: request.query.offset });
    const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 200) : '';
    const sourceType = typeof request.query.sourceType === 'string' ? request.query.sourceType : undefined;
    const status = typeof request.query.status === 'string' ? request.query.status.trim().slice(0, 120) : undefined;
    const scope = typeof request.query.scope === 'string' ? request.query.scope : undefined;
    if (sourceType && !['request', 'ticket', 'custom'].includes(sourceType)) throw new AppError(400, 'INVALID_INPUT', 'Unknown source type filter.');
    if (scope && !['all', 'actionable', 'history'].includes(scope)) throw new AppError(400, 'INVALID_INPUT', 'Unknown case scope filter.');
    const filters: string[] = ['workspace_id = $1'];
    const values: unknown[] = [actor.workspaceId];
    const add = (fragment: string, value: unknown) => { values.push(value); filters.push(fragment.replace('?', `$${values.length}`)); };
    if (search) {
      values.push(search);
      const placeholder = `$${values.length}`;
      filters.push(`(source_id ILIKE '%' || ${placeholder} || '%' OR employee_name ILIKE '%' || ${placeholder} || '%' OR original_text ILIKE '%' || ${placeholder} || '%')`);
    }
    if (sourceType) add('source_kind = ?', sourceType);
    if (status) add('work_state = ?', status);
    if (scope === 'actionable') filters.push('active = true');
    if (scope === 'history') filters.push('active = false');
    values.push(pagination.limit + 1, pagination.offset);
    const result = await query<CaseRow>(
      `SELECT id, source_id, source_kind, source_snapshot, source_status, source_date, employee_name, employee_email,
              original_text, work_state, active, facts, fact_evidence, last_decision, version, created_at, updated_at
       FROM cases WHERE ${filters.join(' AND ')}
       ORDER BY updated_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const hasMore = result.rows.length > pagination.limit;
    response.json({ data: { items: result.rows.slice(0, pagination.limit).map(mapCase), nextOffset: hasMore ? pagination.offset + pagination.limit : null } });
  }));

  app.post('/api/cases', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const input = customCaseSchema.parse(request.body);
    const caseId = randomUUID();
    const sourceId = `CUSTOM-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
    const sourceSnapshot = { id: sourceId, kind: 'custom', text: input.text, sourceStatus: 'New', workState: 'NOT_STARTED', active: true };
    const result = await withTransaction(async (client) => {
      const created = await client.query<CaseRow>(
        `INSERT INTO cases (
          id, workspace_id, source_id, source_kind, source_snapshot, source_status, original_text, work_state, active, employee_name
        ) VALUES ($1, $2, $3, 'custom', $4::jsonb, 'New', $5, 'NOT_STARTED', true, $6)
        RETURNING id, source_id, source_kind, source_snapshot, source_status, source_date, employee_name, employee_email,
          original_text, work_state, active, facts, fact_evidence, last_decision, version, created_at, updated_at`,
        [caseId, actor.workspaceId, sourceId, JSON.stringify(sourceSnapshot), input.text, actor.displayName]
      );
      await appendAudit(client, { workspaceId: actor.workspaceId, actorUserId: actor.userId, caseId, eventType: 'CUSTOM_CASE_CREATED', payload: { sourceId } });
      return created.rows[0];
    });
    response.status(201).json({ data: { case: mapCase(result) } });
  }));

  app.get('/api/cases/:id', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const caseId = idSchema.parse(request.params.id);
    const row = await readOwnedCase(actor, caseId);
    const [messages, ticket, latestRun] = await Promise.all([
      query<{ id: string; role: string; content: string; metadata: Record<string, unknown>; created_at: Date | string }>(
        `SELECT id, role, content, metadata, created_at FROM messages
         WHERE workspace_id = $1 AND case_id = $2 ORDER BY created_at ASC, id ASC`,
        [actor.workspaceId, caseId]
      ),
      query<TicketRow>(
        `SELECT id, workspace_id, case_id, display_id, route, state, original_status, summary, reason_code,
                policy_source_ids, history_source_ids, created_at, updated_at
         FROM service_tickets WHERE workspace_id = $1 AND case_id = $2`,
        [actor.workspaceId, caseId]
      ),
      query<{
        id: string; status: string; agent_mode: string | null; result: unknown | null; safe_error_code: string | null; started_at: Date | string; finished_at: Date | string | null;
      }>(
        `SELECT id, status, agent_mode, result, safe_error_code, started_at, finished_at
         FROM runs WHERE workspace_id = $1 AND case_id = $2
         ORDER BY started_at DESC, id DESC LIMIT 1`,
        [actor.workspaceId, caseId]
      )
    ]);
    const policyIds = Array.isArray(row.last_decision?.sourceIds) ? row.last_decision.sourceIds.filter((id): id is string => typeof id === 'string') : [];
    const policies = policyIds.length
      ? await query<{ id: string; title: string; body: string; source_file: string; source_page: number; source_section: string; metadata: Record<string, unknown> }>(
        `SELECT id, title, body, source_file, source_page, source_section, metadata FROM policies WHERE id = ANY($1::text[])`, [policyIds])
      : { rows: [] };
    const byPolicyId = new Map(policies.rows.map((policy) => [policy.id, policy]));
    response.json({
      data: {
        case: mapCase(row),
        messages: messages.rows.map((message) => ({ id: message.id, role: message.role, content: message.content, metadata: message.metadata, createdAt: iso(message.created_at) })),
        decision: row.last_decision,
        ticket: ticket.rows[0] ? mapTicket(ticket.rows[0]) : null,
        latestRun: latestRun.rows[0] ? mapRun(latestRun.rows[0]) : null,
        policies: policyIds.flatMap((id) => {
          const policy = byPolicyId.get(id);
          if (!policy) return [];
          const metadata = policy.metadata ?? {};
          return [{
            id: policy.id, title: policy.title, text: policy.body, sourceFile: policy.source_file,
            page: policy.source_page, section: policy.source_section,
            authority: metadata.authority, issuer: metadata.issuer, lastUpdated: metadata.lastUpdated,
            relatedConflictIds: metadata.relatedConflictIds ?? []
          }];
        })
      }
    });
  }));

  const runRoute = (operation: 'analyze' | 'message') => asyncRoute(async (request: Request, response: Response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const caseId = idSchema.parse(request.params.id);
    const input = operation === 'analyze' ? analyzeSchema.parse(request.body) : messageSchema.parse(request.body);
    const latestText = operation === 'analyze'
      ? (await readOwnedCase(actor, caseId)).original_text
      : (input as z.infer<typeof messageSchema>).message;
    const reservation = await reserveRun({
      actor,
      caseId,
      idempotencyKey: input.idempotencyKey,
      latestText,
      expectedVersion: input.expectedVersion,
      operation
    });
    if (!reservation.shouldExecute) {
      response.status(reservation.run.status === 'RUNNING' ? 202 : 200).json({ data: { run: reservation.run, replay: true } });
      return;
    }
    const run = await executeReservedRun({ actor, caseId, runId: reservation.run.id, latestText });
    response.json({ data: { run, replay: false } });
  });

  app.post('/api/cases/:id/analyze', authenticate, agentRateLimit, runRoute('analyze'));
  app.post('/api/cases/:id/messages', authenticate, agentRateLimit, runRoute('message'));

  app.get('/api/runs/by-key/:key', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const key = idempotencySchema.parse(request.params.key);
    const result = await query<{
      id: string; status: string; agent_mode: string | null; result: unknown | null; safe_error_code: string | null; started_at: Date | string; finished_at: Date | string | null;
    }>(
      `SELECT id, status, agent_mode, result, safe_error_code, started_at, finished_at
       FROM runs WHERE workspace_id = $1 AND idempotency_key = $2`,
      [actor.workspaceId, key]
    );
    if (!result.rows[0]) throw new AppError(404, 'RUN_NOT_FOUND', 'No run was found for this key.');
    response.json({ data: { run: mapRun(result.rows[0]) } });
  }));

  app.get('/api/runs/:id/events', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const runId = idSchema.parse(request.params.id);
    await getOwnedRun(actor, runId);
    const after = z.coerce.number().int().min(0).optional().parse(request.query.after);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
    const events = await query<{
      sequence_id: number; id: string; event_type: string; node_name: string | null; payload: Record<string, unknown>; occurred_at: Date | string;
    }>(
      `SELECT sequence_id, id, event_type, node_name, payload, occurred_at
       FROM audit_events WHERE workspace_id = $1 AND run_id = $2 AND sequence_id > $3
       ORDER BY sequence_id ASC LIMIT $4`,
      [actor.workspaceId, runId, after ?? 0, limit]
    );
    response.json({ data: { items: events.rows.map((event) => ({ sequenceId: event.sequence_id, id: event.id, eventType: event.event_type, nodeName: event.node_name, payload: event.payload, occurredAt: iso(event.occurred_at) })), nextAfter: events.rows.at(-1)?.sequence_id ?? null } });
  }));

  app.get('/api/policies', authenticate, asyncRoute(async (request, response) => {
    const q = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 160) : '';
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
    const policies = q
      ? await query<{ id: string; title: string; body: string; source_file: string; source_page: number; source_section: string; metadata: Record<string, unknown> }>(
        `SELECT id, title, body, source_file, source_page, source_section, metadata
         FROM policies WHERE search_vector @@ plainto_tsquery('english', $1) ORDER BY id ASC LIMIT $2`, [q, limit])
      : await query<{ id: string; title: string; body: string; source_file: string; source_page: number; source_section: string; metadata: Record<string, unknown> }>(
        'SELECT id, title, body, source_file, source_page, source_section, metadata FROM policies ORDER BY id ASC LIMIT $1', [limit]);
    response.json({ data: { items: policies.rows.map((policy) => {
      const metadata = policy.metadata ?? {};
      return {
        id: policy.id, title: policy.title, text: policy.body, sourceFile: policy.source_file, page: policy.source_page,
        section: policy.source_section, authority: metadata.authority, issuer: metadata.issuer,
        lastUpdated: metadata.lastUpdated, relatedConflictIds: metadata.relatedConflictIds ?? []
      };
    }) } });
  }));

  app.get('/api/policies/:id', authenticate, asyncRoute(async (request, response) => {
    const id = z.string().regex(/^(KB-\d{2}|ASSET-01)$/).parse(request.params.id);
    const result = await query<{ id: string; title: string; body: string; source_file: string; source_page: number; source_section: string; metadata: Record<string, unknown> }>(
      'SELECT id, title, body, source_file, source_page, source_section, metadata FROM policies WHERE id = $1', [id]
    );
    const policy = result.rows[0];
    if (!policy) throw new AppError(404, 'POLICY_NOT_FOUND', 'The requested policy was not found.');
    const metadata = policy.metadata ?? {};
    response.json({ data: { policy: {
      id: policy.id, title: policy.title, text: policy.body, sourceFile: policy.source_file, page: policy.source_page,
      section: policy.source_section, authority: metadata.authority, issuer: metadata.issuer,
      lastUpdated: metadata.lastUpdated, relatedConflictIds: metadata.relatedConflictIds ?? []
    } } });
  }));

  app.get('/api/tickets', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const view = typeof request.query.view === 'string' ? request.query.view : 'all';
    if (!['all', 'open', 'history'].includes(view)) throw new AppError(400, 'INVALID_INPUT', 'Unknown ticket filter.');
    const route = typeof request.query.route === 'string' ? request.query.route : undefined;
    if (route && !['IT', 'SECURITY', 'FINANCE', 'MANAGER', 'IT_FINANCE', 'MANAGER_FINANCE'].includes(route)) {
      throw new AppError(400, 'INVALID_INPUT', 'Unknown ticket queue.');
    }
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
    const offset = z.coerce.number().int().min(0).max(10_000).default(0).parse(request.query.offset);
    const stateFilter = view === 'open' ? 'AND c.active = true' : view === 'history' ? 'AND c.active = false' : '';
    const values: Array<string | number> = [actor.workspaceId];
    const routeFilter = route ? `AND t.route = $${values.push(route)}` : '';
    values.push(limit, offset);
    const tickets = await query<TicketRow>(
      `SELECT t.id, t.workspace_id, t.case_id, t.display_id, t.route, t.state, t.original_status, t.summary, t.reason_code,
              t.policy_source_ids, t.history_source_ids, t.created_at, t.updated_at, c.source_id, c.active
       FROM service_tickets t JOIN cases c ON c.id = t.case_id AND c.workspace_id = t.workspace_id
       WHERE t.workspace_id = $1 ${stateFilter} ${routeFilter} ORDER BY t.updated_at DESC, t.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    response.json({ data: { items: tickets.rows.map(mapTicket) } });
  }));

  app.get('/api/tickets/:id', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const ticketId = idSchema.parse(request.params.id);
    const result = await query<TicketRow & CaseRow>(
      `SELECT t.id, t.workspace_id, t.case_id, t.display_id, t.route, t.state, t.original_status, t.summary, t.reason_code,
              t.policy_source_ids, t.history_source_ids, t.created_at, t.updated_at, c.source_id, c.active
       FROM service_tickets t JOIN cases c ON c.id = t.case_id AND c.workspace_id = t.workspace_id
       WHERE t.id = $1 AND t.workspace_id = $2`,
      [ticketId, actor.workspaceId]
    );
    const ticket = result.rows[0];
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'The requested ticket was not found.');
    const caseRecord = await readOwnedCase(actor, ticket.case_id);
    response.json({ data: { ticket: mapTicket(ticket), case: mapCase(caseRecord) } });
  }));

  app.get('/api/audit', authenticate, asyncRoute(async (request, response) => {
    const actor = requireActor(request as AuthenticatedRequest);
    const caseId = request.query.caseId === undefined ? undefined : idSchema.parse(request.query.caseId);
    const runId = request.query.runId === undefined ? undefined : idSchema.parse(request.query.runId);
    const after = z.coerce.number().int().min(0).optional().parse(request.query.after);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
    const values: unknown[] = [actor.workspaceId, after ?? 0];
    const filters = ['workspace_id = $1', 'sequence_id > $2'];
    if (caseId) { values.push(caseId); filters.push(`case_id = $${values.length}`); }
    if (runId) { values.push(runId); filters.push(`run_id = $${values.length}`); }
    values.push(limit);
    const events = await query<{
      sequence_id: number; id: string; case_id: string | null; run_id: string | null; event_type: string; node_name: string | null; payload: Record<string, unknown>; occurred_at: Date | string;
    }>(
      `SELECT sequence_id, id, case_id, run_id, event_type, node_name, payload, occurred_at
       FROM audit_events WHERE ${filters.join(' AND ')} ORDER BY sequence_id ASC LIMIT $${values.length}`,
      values
    );
    response.json({ data: { items: events.rows.map((event) => ({
      sequenceId: event.sequence_id, id: event.id, caseId: event.case_id, runId: event.run_id,
      eventType: event.event_type, nodeName: event.node_name, payload: event.payload, occurredAt: iso(event.occurred_at)
    })), nextAfter: events.rows.at(-1)?.sequence_id ?? null } });
  }));

  app.get('/api/settings/runtime', authenticate, (_request, response) => {
    response.json({ data: {
      mode: runtimeMode(),
      configuredMode: config.agentMode,
      model: config.geminiModel,
      geminiConfigured: Boolean(config.geminiApiKey),
      sourceVersion: '2026-09-21-to-2026-09-25',
      limitation: 'This workspace records local guidance and handoffs only; it does not change external accounts or send emails.'
    } });
  });

  app.use((_request, _response, next) => next(new AppError(404, 'NOT_FOUND', 'The requested API route was not found.')));
  app.use(errorMiddleware);
  return app;
}
