import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { PostgresPersistence } from '../../src/lib/server/repositories';
config({ path: '.env.db', quiet: true });

test('limpieza y credenciales quedan limitadas a su base y al preparador dueño', async () => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!, secondUrl = process.env.RELEVO_BACKEND_TEST_ISOLATION_URL!;
  const db = localClient(url), second = localClient(secondUrl);
  const one = fixturePreparer(db, url), two = fixturePreparer(second, secondUrl);
  try {
    const a = await one.prepare(BASE_FIXTURE), b = await two.prepare(BASE_FIXTURE);
    try {
      await assert.rejects(two.dispose(a.executionId), /no creó/);
      await assert.rejects(fixturePreparer(db, url).dispose(a.executionId), /no creó/);
      await one.dispose(a.executionId);
      assert.equal(await new PostgresPersistence(db).current(), null);
      assert.equal((await new PostgresPersistence(second).current())?.executionId, b.executionId);
      const sessions = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM report_sessions WHERE id=${a.sessionId}`;
      assert.equal(sessions[0].n, 0);
      await assert.rejects(db.$executeRaw`CREATE TABLE unauthorized_t03(id int)`);
      await assert.rejects(db.$queryRaw`SELECT * FROM "_prisma_migrations"`);
      const alienUrl = new URL(url); alienUrl.pathname = '/relevo_backend_test_isolation';
      const alien = localClient(alienUrl.toString());
      try { await assert.rejects(alien.$queryRaw`SELECT 1`); } finally { await alien.$disconnect(); }
    } finally { await two.dispose(b.executionId); }
  } finally { await db.$disconnect(); await second.$disconnect(); }
});
