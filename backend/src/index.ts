import { createServer } from 'node:http';
import { appendAudit } from './audit.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, query, withTransaction } from './db.js';

async function recoverInterruptedRuns(): Promise<void> {
  const interrupted = await query<{ id: string; workspace_id: string; case_id: string; actor_user_id: string | null }>(
    `UPDATE runs r SET status = 'INTERRUPTED', safe_error_code = 'API_RESTARTED', finished_at = now()
     WHERE r.status = 'RUNNING'
     RETURNING r.id, r.workspace_id, r.case_id, (
       SELECT owner_user_id FROM workspaces WHERE id = r.workspace_id
     ) AS actor_user_id`
  );
  if (interrupted.rowCount === 0) return;
  await withTransaction(async (client) => {
    for (const run of interrupted.rows) {
      await appendAudit(client, {
        workspaceId: run.workspace_id,
        actorUserId: run.actor_user_id,
        caseId: run.case_id,
        runId: run.id,
        eventType: 'RUN_INTERRUPTED',
        payload: { code: 'API_RESTARTED' }
      });
    }
  });
}

const app = createApp();
const server = createServer(app);

server.listen(config.port, '0.0.0.0', () => {
  // This intentionally carries no environment dump or connection string.
  console.info(`Veridian API listening on port ${config.port}`);
});

void recoverInterruptedRuns().catch(() => {
  // Readiness stays false until migrations/PostgreSQL become reachable; the server
  // remains up so its health endpoint can give Docker and local users a clear signal.
  console.warn('Veridian API started before its database was ready.');
});

async function shutdown(signal: string) {
  server.close(async () => {
    try {
      await closeDatabase();
    } finally {
      process.exit(signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
