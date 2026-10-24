import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import { publicStateExample } from '../../src/lib/contracts/examples';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import type { CommandContext } from '../../src/lib/contracts/auth';
import type { Execution, Incident, NotificationIntent, Report } from '../../src/lib/contracts/domain';
import { LIMITS, type Instant, type ReportSessionId } from '../../src/lib/contracts/core';
import type { PreparedExecution } from '../../src/lib/contracts/services';
import type { IdempotencyRecord, SavedResponse, TransactionRepositories } from '../../src/lib/contracts/repositories';
import type { ServiceResult } from '../../src/lib/contracts/http';
config({ path: '.env.db', quiet: true });
const success = <T>(value: T) => ({ ok: true as const, value });
const ctx = (p: PreparedExecution): CommandContext => ({ executionId: p.executionId, executionVersion: 1, principal: { kind: 'system' }, actorId: null, origin: 'system', operationalNow: BASE_FIXTURE.operationalAt, narrativeNow: BASE_FIXTURE.narrativeAt, correlationId: 'correlation_atomic' });
async function checked<T>(p: PostgresPersistence, c: CommandContext, fn: (r: TransactionRepositories) => Promise<ServiceResult<T>>): Promise<T> { const result = await p.run(c, fn); assert.ok(result.ok, JSON.stringify(result)); return result.value; }
const at = (ms: number): Instant => new Date(Date.parse(BASE_FIXTURE.narrativeAt) + ms).toISOString() as Instant;
const makeReport = (p: PreparedExecution, sequence: number, sessionId = p.sessionId): Report => ({ id: `report_${randomUUID()}`, executionId: p.executionId, version: 1, admissionSequence: sequence, sessionId, nickname: 'Prueba', text: 'Hecho sintético', origin: 'web', operationalAt: BASE_FIXTURE.operationalAt, narrativeAt: at(0), correlationId: 'correlation_atomic', principalKey: `session:${sessionId}`, idempotencyKey: `report-${sequence}`, status: 'processing', classification: null, decision: null, incidentId: null });

test('equivalencia, decisiones ordenadas, eventos, cuotas globales y reset', async t => {
  const db = localClient(process.env.RELEVO_BACKEND_TEST_URL!); const fixtures = fixturePreparer(db, process.env.RELEVO_BACKEND_TEST_URL!); const store = new PostgresPersistence(db);
  try {
    await t.test('equivalencia serializada respeta ambos lados del límite y hechos distintos', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE), c = ctx(p);
      try {
        const key = { mode: 'text' as const, normalizedText: 'local 1 sin red' };
        const register = () => checked(store, c, async r => {
          const q = await r.reserveReportQuota(p.sessionId); assert.ok(q.ok);
          const report = makeReport(p, q.value.admissionSequence); await r.aggregates.reports.insert(report);
          await r.equivalence.lock(key); const existing = await r.equivalence.findWithinWindow(key, at(0));
          if (existing) { await r.equivalence.linkReport(report.id, existing.id); return success(existing.id); }
          const incident: Incident = { id: `incident_${randomUUID()}`, executionId: p.executionId, version: 1, status: 'unacknowledged', firstReportId: report.id, equivalence: key, firstNarrativeAt: at(0), currentAttemptId: null, takenBy: null, takenAt: null };
          await r.aggregates.incidents.insert(incident); await r.equivalence.linkReport(report.id, incident.id); return success(incident.id);
        });
        const ids = await Promise.all([register(), register()]); assert.equal(ids[0], ids[1]);
        await checked(store, c, async r => {
          assert.equal((await r.aggregates.incidents.list()).length, 1);
          assert.equal((await r.equivalence.findWithinWindow(key, at(599999)))?.id, ids[0]);
          assert.equal(await r.equivalence.findWithinWindow(key, at(600000)), null);
          assert.equal(await r.equivalence.findWithinWindow(key, at(600001)), null);
          assert.equal(await r.equivalence.findWithinWindow(key, at(-1)), null);
          assert.equal(await r.equivalence.findWithinWindow({ mode: 'text', normalizedText: 'local 2 sin red' }, at(0)), null);
          const original = (await r.aggregates.incidents.list())[0];
          const q = await r.reserveReportQuota(p.sessionId); assert.ok(q.ok); const newer = makeReport(p, q.value.admissionSequence); await r.aggregates.reports.insert(newer);
          await r.aggregates.incidents.insert({ ...original, id: `incident_${randomUUID()}`, firstReportId: newer.id, firstNarrativeAt: at(5000) });
          assert.equal((await r.equivalence.findWithinWindow(key, at(6000)))?.firstReportId, newer.id);
          return success(null);
        });
        // Fuerza colisión almacenada de hash: la comparación de JSON completo conserva hechos distintos.
        await db.$executeRaw`UPDATE incidents SET equivalence='{"mode":"text","normalizedText":"otro hecho"}'::jsonb WHERE id=${ids[0]}`;
        await checked(store, c, async r => { assert.equal(await r.equivalence.findWithinWindow(key, at(0)), null); return success(null); });
      } finally { await fixtures.dispose(p.executionId); }
    });
    await t.test('clasificación guardada fuera de orden no oculta el prefijo pendiente', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE), c = ctx(p);
      try {
        await checked(store, c, async r => {
          for (let i = 1; i <= 2; i++) { const q = await r.reserveReportQuota(p.sessionId); assert.ok(q.ok); await r.aggregates.reports.insert(makeReport(p, i)); }
          const reports = await r.reportsAwaitingDecision(); const second = reports[1];
          assert.equal(await r.aggregates.reports.compareAndSwap({ ...second, version: 2, classification: { mode: 'degraded', reportId: second.id, reason: 'timeout', output: null } }, { executionId: p.executionId, version: 1, status: 'processing' }), true);
          const pending = await r.reportsAwaitingDecision(); assert.deepEqual(pending.map(x => x.admissionSequence), [1, 2]); assert.equal(pending[0].classification, null); assert.equal(pending[1].classification?.mode, 'degraded');
          return success(null);
        });
      } finally { await fixtures.dispose(p.executionId); }
    });
    await t.test('secuencia de eventos e intención lógica única se confirman juntas', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE), c = ctx(p);
      try {
        const actor = p.handoff.outgoingActorId;
        const notice: NotificationIntent = { id: `notification_${randomUUID()}`, executionId: p.executionId, version: 1, subject: { kind: 'coordination', entity: { kind: 'handoff', id: p.handoff.id } }, recipientActorId: actor, channel: 'in_app', logicalKey: 'handoff:coordination', status: 'pending', createdAt: c.operationalNow };
        const result = await Promise.all([1, 2].map(() => store.run(c, async r => {
          await r.events.append({ executionId: p.executionId, kind: 'notification_intended', entity: { kind: 'handoff', id: p.handoff.id }, entityVersion: 1, actorId: actor, principal: { kind: 'system' }, origin: 'system', channel: 'in_app', details: { kind: 'record' }, operationalAt: c.operationalNow, narrativeAt: c.narrativeNow, correlationId: c.correlationId, result: 'recorded' });
          await r.aggregates.notifications.insert({ ...notice, id: `notification_${randomUUID()}` }); return success(null);
        })));
        assert.equal(result.filter(x => x.ok).length, 1);
        await checked(store, c, async r => { assert.deepEqual((await r.events.list()).map(e => e.sequence), [1]); assert.equal((await r.aggregates.notifications.list()).length, 1); return success(null); });
      } finally { await fixtures.dispose(p.executionId); }
    });
    await t.test('un ingreso sobre el máximo global, repartido en sesiones con cuota, queda rechazado', async () => {
      const max = LIMITS.reportsPerExecution, total = max + 1, count = Math.ceil(total / LIMITS.reportsPerSession);
      const p = await fixtures.prepare(BASE_FIXTURE), c = ctx(p); const sessions: ReportSessionId[] = [];
      try {
        await checked(store, c, async r => { for (let i = 0; i < count; i++) { const id: ReportSessionId = `session_${randomUUID()}`; sessions.push(id); await r.credentials.saveSession({ id, credentialHash: randomUUID().replaceAll('-', '').repeat(2), expiresAt: '2026-10-24T15:00:00.000Z' }); } return success(null); });
        const results = [];
        // Lotes de tres conexiones; cada petición compite en una TX real.
        for (let i = 0; i < total; i += 3)results.push(...await Promise.all(Array.from({ length: Math.min(3, total - i) }, (_, j) => store.run(c, async r => {
          const session = sessions[(i + j) % count]; const q = await r.reserveReportQuota(session); if (!q.ok) return q; await r.aggregates.reports.insert(makeReport(p, q.value.admissionSequence, session)); return success(null);
        }))));
        assert.equal(results.filter(x => x.ok).length, max); assert.equal(results.filter(x => !x.ok && x.code === 'QUOTA_EXCEEDED').length, 1);
        await checked(store, c, async r => { assert.equal((await r.aggregates.reports.list()).length, max); return success(null); });
      } finally { await fixtures.dispose(p.executionId); for (const s of sessions) await db.$executeRaw`DELETE FROM report_sessions WHERE id=${s}`; }
    });
    await t.test('reset cambia ejecución atómicamente; replay y escrituras antiguas quedan acotados', async () => {
      const p = await fixtures.prepare(BASE_FIXTURE), c = ctx(p);
      const old = (await store.current())!;
      const next: Execution = { ...old, executionId: `execution_${randomUUID()}`, version: 1 };
      const reservation: Extract<IdempotencyRecord, { status: 'pending' }> = { executionId: p.executionId, principalKey: 'control:demo', operation: 'POST /api/reset', key: 'reset-1', fingerprint: 'b'.repeat(64), createdAt: c.operationalNow, status: 'pending', response: null, successorExecutionId: null };
      const saved: SavedResponse = { route: 'POST /api/reset', response: { status: 201, body: { ok: true, data: { previousExecutionId: p.executionId, executionId: next.executionId, preparation: 'pending', state: { ...publicStateExample, executionId: next.executionId, version: 1, preparation: 'pending', channelOpen: false } }, correlationId: c.correlationId } } };
      try {
        await checked(store, c, async r => {
          await r.idempotency.reserve(reservation); const successor = await r.replaceExecution(next, 1); assert.ok(successor);
          assert.equal((await successor.reference.actors()).length, 4); assert.equal((await successor.reference.scenes()).length, 4);
          await r.idempotency.complete(reservation, saved, next.executionId); return success(null);
        });
        assert.equal((await store.current())?.executionId, next.executionId);
        assert.deepEqual(await store.run(c, async () => success(null)), { ok: false, code: 'EXECUTION_STALE' });
        assert.deepEqual(await store.replayReset({ ...reservation, key: 'missing' }, 'b'.repeat(64)), { ok: false, code: 'EXECUTION_STALE' });
        assert.deepEqual(await store.replayReset(reservation, 'b'.repeat(64)), success(saved));
        assert.deepEqual(await store.replayReset(reservation, 'c'.repeat(64)), { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
        const nextContext = { ...c, executionId: next.executionId };
        const third: Execution = { ...next, executionId: `execution_${randomUUID()}` };
        await checked(store, nextContext, async r => { assert.ok(await r.replaceExecution(third, 1)); return success(null); });
        assert.deepEqual(await store.replayReset(reservation, 'b'.repeat(64)), { ok: false, code: 'EXECUTION_STALE' });
      } finally {
        // La limpieza de cadenas requiere eliminar dependencias dentro de una sola TX.
        await db.$transaction(async tx => {
          await tx.$executeRaw`DELETE FROM idempotency_records WHERE "executionId"=${p.executionId}`;
          await tx.$executeRaw`DELETE FROM executions WHERE "executionId"=${p.executionId} OR "executionId"=${next.executionId} OR "executionId" IN (SELECT "supersededBy" FROM executions WHERE "executionId"=${next.executionId})`;
        });
        // El preparador conserva su propiedad, aunque la ejecución ya se haya retirado.
        await fixtures.dispose(p.executionId);
      }
    });
  } finally { await db.$disconnect(); }
});
