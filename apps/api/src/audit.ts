import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export async function appendAudit(
  client: PoolClient,
  input: {
    workspaceId: string;
    actorUserId?: string | null;
    caseId?: string | null;
    runId?: string | null;
    eventType: string;
    nodeName?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (id, workspace_id, actor_user_id, case_id, run_id, event_type, node_name, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      randomUUID(),
      input.workspaceId,
      input.actorUserId ?? null,
      input.caseId ?? null,
      input.runId ?? null,
      input.eventType,
      input.nodeName ?? null,
      JSON.stringify(input.payload ?? {})
    ]
  );
}
