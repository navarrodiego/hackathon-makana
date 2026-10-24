import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import { holdLock, within } from '../helpers/db/lock';
import type { CommandContext } from '../../src/lib/contracts/auth';
import type { Report, ReportSession } from '../../src/lib/contracts/domain';
import type { Instant, ReportSessionId } from '../../src/lib/contracts/core';
import type { PreparedExecution } from '../../src/lib/contracts/services';
config({ path: '.env.db', quiet: true });

const ctx = (p: PreparedExecution): CommandContext => ({ executionId: p.executionId, executionVersion: 1, principal: { kind: 'system' }, actorId: null, origin: 'system', operationalNow: BASE_FIXTURE.operationalAt, narrativeNow: BASE_FIXTURE.narrativeAt, correlationId: 'correlation_read_first' });
const makeReport = (p: PreparedExecution, sequence: number): Report => ({ id: `report_${randomUUID()}`, executionId: p.executionId, version: 1, admissionSequence: sequence, sessionId: p.sessionId, nickname: 'Prueba', text: 'Hecho sintético', origin: 'web', operationalAt: BASE_FIXTURE.operationalAt, narrativeAt: BASE_FIXTURE.narrativeAt, correlationId: 'correlation_read_first', principalKey: `session:${p.sessionId}`, idempotencyKey: `report-${sequence}`, status: 'processing', classification: null, decision: null, incidentId: null });
test('lecturas, vencimientos y sesiones sin esperar el candado global', async t => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!;
  const db = localClient(url); const fixtures = fixturePreparer(db, url); const store = new PostgresPersistence(db);
  try {
    await t.test('una lectura termina mientras otra transacción tiene el candado', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE);
      const lock = holdLock(db);
      try {
        await lock.acquired;
        const result = await within(2_000, store.runReadFirst(ctx(p), async tx => ({ ok: true as const, value: (await tx.aggregates.handoffs.list()).length })));
        assert.notEqual(result, 'timeout');
        assert.deepEqual(result, { ok: true, value: 1 });
      } finally { await lock.release(); await fixtures.dispose(p.executionId); }
    });
    await t.test('si el trabajo escribe, se repite con el candado y la escritura queda guardada una vez', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE);
      try {
        let attempts = 0;
        const result = await store.runReadFirst(ctx(p), async tx => {
          attempts++;
          const q = await tx.reserveReportQuota(p.sessionId); assert.ok(q.ok);
          await tx.aggregates.reports.insert(makeReport(p, q.value.admissionSequence));
          return { ok: true as const, value: null };
        });
        assert.deepEqual(result, { ok: true, value: null });
        assert.equal(attempts, 2);
        const rows = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM reports WHERE "executionId"=${p.executionId}`;
        assert.equal(rows[0].n, 1);
      } finally { await fixtures.dispose(p.executionId); }
    });
    await t.test('la escritura repetida espera el candado como run', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE);
      const lock = holdLock(db);
      try {
        await lock.acquired;
        const pending = store.runReadFirst(ctx(p), async tx => {
          const q = await tx.reserveReportQuota(p.sessionId); assert.ok(q.ok);
          await tx.aggregates.reports.insert(makeReport(p, q.value.admissionSequence));
          return { ok: true as const, value: null };
        });
        assert.equal(await within(500, pending), 'timeout');
        await lock.release();
        assert.deepEqual(await pending, { ok: true, value: null });
      } finally { await lock.release(); await fixtures.dispose(p.executionId); }
    });
    await t.test('una ejecución retirada responde EXECUTION_STALE sin tocar nada', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE);
      try {
        const result = await store.runReadFirst({ ...ctx(p), executionId: 'execution_retirada' as CommandContext['executionId'] }, async () => ({ ok: true as const, value: null }));
        assert.deepEqual(result, { ok: false, code: 'EXECUTION_STALE' });
      } finally { await fixtures.dispose(p.executionId); }
    });
    await t.test('una sesión nueva se guarda mientras otra transacción tiene el candado', async () => {
      const lock = holdLock(db);
      const session: ReportSession = { id: `session_${randomUUID()}` as ReportSessionId, credentialHash: createHash('sha256').update(randomUUID()).digest('hex'), expiresAt: '2030-01-01T00:00:00.000Z' as Instant };
      try {
        await lock.acquired;
        assert.notEqual(await within(2_000, store.saveSession(session)), 'timeout');
        assert.equal((await store.findSession(session.credentialHash))?.id, session.id);
      } finally {
        await lock.release();
        await db.$executeRaw`DELETE FROM report_sessions WHERE id=${session.id}`;
      }
    });
  } finally { await db.$disconnect(); }
});

test('listar reportes no hace dos consultas por reporte', async () => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!;
  const counted = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c TimeZone=UTC', max: 3 }), log: [{ emit: 'event', level: 'query' }] });
  const fixtures = fixturePreparer(counted, url); const store = new PostgresPersistence(counted);
  let queries = 0; counted.$on('query', () => { queries++; });
  const p = await fixtures.prepare(BASE_FIXTURE);
  try {
    const result = await store.run(ctx(p), async tx => {
      for (let i = 1; i <= 5; i++) {
        const q = await tx.reserveReportQuota(p.sessionId); assert.ok(q.ok);
        const report = makeReport(p, q.value.admissionSequence);
        await tx.aggregates.reports.insert({ ...report, classification: { mode: 'degraded', reportId: report.id, reason: 'timeout', output: null } });
      }
      queries = 0;
      const reports = await tx.aggregates.reports.list();
      return { ok: true as const, value: { reports, queries } };
    });
    assert.ok(result.ok);
    assert.equal(result.value.reports.length, 5);
    assert.ok(result.value.reports.every(r => r.classification?.mode === 'degraded' && r.decision === null));
    assert.ok(result.value.queries <= 3, `consultas: ${result.value.queries}`);
  } finally { await fixtures.dispose(p.executionId); await counted.$disconnect(); }
});
