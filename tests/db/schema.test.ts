import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { localDestination, verifyLocalConnection } from '../../scripts/db/destination';
config({ path: '.env.db', quiet: true });

test('migración materializa tablas y unicidad de ejecución activa', async () => {
  const url = localDestination(process.env.RELEVO_BACKEND_TEST_URL, true).url;
  const db = localClient(url);
  try {
    await verifyLocalConnection(db, url, true);
    const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    for (const table of ['executions', 'actors', 'scenes', 'tickets', 'handoffs', 'handoff_attempts', 'coverage_windows', 'coverages', 'report_sessions', 'recipient_grants', 'reports', 'report_classifications', 'report_policy_decisions', 'incidents', 'incident_attempts', 'events', 'notification_intents', 'idempotency_records'])
      assert.ok(tables.some(t => t.tablename === table), `Falta tabla ${table}`);
    const indexes = await db.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE tablename='executions'`;
    assert.ok(indexes.some(i => i.indexname === 'one_active_execution'));
  } finally { await db.$disconnect(); }
});
