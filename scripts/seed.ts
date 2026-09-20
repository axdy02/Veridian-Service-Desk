import { randomUUID } from 'node:crypto';
import { hashPassword } from '@veridian/domain/auth';
import { seedPolicies, seedWorkspace } from '../apps/api/src/seeding.js';
import { createDatabasePool } from './database.js';

const email = process.env.DEMO_REVIEWER_EMAIL?.trim().toLowerCase();
const displayName = process.env.DEMO_REVIEWER_NAME?.trim();
const password = process.env.DEMO_REVIEWER_PASSWORD;
const pool = createDatabasePool();

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const policyCount = await seedPolicies(client);
    if (email || displayName || password) {
      if (!email || !displayName || !password) {
        throw new Error('Set DEMO_REVIEWER_EMAIL, DEMO_REVIEWER_NAME, and DEMO_REVIEWER_PASSWORD together to seed the demo account.');
      }
      const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows[0]) {
        console.info('Demo reviewer already exists; its workspace and password were left unchanged.');
      } else {
        const userId = randomUUID();
        const workspaceId = randomUUID();
        const passwordHash = await hashPassword(password);
        await client.query('INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)', [userId, email, displayName, passwordHash]);
        await client.query('INSERT INTO workspaces (id, owner_user_id, name) VALUES ($1, $2, $3)', [workspaceId, userId, 'Assessment sandbox']);
        const seeded = await seedWorkspace(client, { workspaceId, ownerUserId: userId });
        console.info(`Created the configured demo reviewer with ${seeded.caseCount} cases and ${seeded.ticketCount} source tickets.`);
      }
    } else {
      console.info('Policy dataset seeded. No demo reviewer was configured; signup creates a private seeded workspace.');
    }
    await client.query('COMMIT');
    console.info(`Seed complete (${policyCount} immutable policy passages available).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
