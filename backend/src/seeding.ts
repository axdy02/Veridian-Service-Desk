import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { appendAudit } from './audit.js';
import { loadPolicies, loadSourceCases, type CaseSeed } from './data.js';

export async function seedPolicies(client: PoolClient): Promise<number> {
  const policies = await loadPolicies();
  for (const policy of policies) {
    await client.query(
      `INSERT INTO policies (id, title, body, source_file, source_page, source_section, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        policy.id,
        policy.title,
        policy.text,
        policy.sourceFile,
        policy.page,
        policy.section,
        JSON.stringify({
          authority: policy.authority,
          issuer: policy.issuer,
          lastUpdated: policy.lastUpdated,
          relatedConflictIds: policy.relatedConflictIds
        })
      ]
    );
  }
  return policies.length;
}

function sourceRoute(record: CaseSeed): string | null {
  if (!record.active) return null;
  if (record.workState === 'PENDING_FULFILLMENT') return 'IT_FINANCE';
  if (record.workState === 'WAITING_FINANCE') return 'FINANCE';
  if (record.workState === 'WAITING_SECURITY' || record.workState === 'SECURITY_INVESTIGATION') return 'SECURITY';
  return 'IT';
}

/** Clone the immutable supplied dataset into exactly one private workspace. */
export async function seedWorkspace(
  client: PoolClient,
  input: { workspaceId: string; ownerUserId: string }
): Promise<{ caseCount: number; ticketCount: number }> {
  const sources = await loadSourceCases();
  const sourceCaseIds = new Map<string, string>();

  for (const source of sources) {
    const caseId = randomUUID();
    sourceCaseIds.set(source.id, caseId);
    await client.query(
      `INSERT INTO cases (
        id, workspace_id, source_id, source_kind, source_snapshot, source_status, source_date,
        employee_name, employee_email, original_text, work_state, active
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::date, $8, $9, $10, $11, $12)`,
      [
        caseId,
        input.workspaceId,
        source.id,
        source.kind,
        JSON.stringify(source),
        source.sourceStatus,
        source.sourceDate,
        source.employeeName,
        source.employeeEmail,
        source.text,
        source.workState,
        source.active
      ]
    );
  }

  const sourceTickets = sources.filter((record) => record.kind === 'ticket');
  for (const ticket of sourceTickets) {
    await client.query(
      `INSERT INTO service_tickets (
        id, workspace_id, case_id, display_id, route, state, original_status, summary,
        reason_code, policy_source_ids, history_source_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, '[]'::jsonb, '[]'::jsonb)`,
      [
        randomUUID(),
        input.workspaceId,
        sourceCaseIds.get(ticket.id),
        ticket.id,
        sourceRoute(ticket),
        ticket.workState,
        ticket.sourceStatus,
        ticket.text
      ]
    );
  }

  await appendAudit(client, {
    workspaceId: input.workspaceId,
    actorUserId: input.ownerUserId,
    eventType: 'WORKSPACE_SEEDED',
    payload: { sourceCaseCount: sources.length, sourceTicketCount: sourceTickets.length }
  });
  return { caseCount: sources.length, ticketCount: sourceTickets.length };
}
