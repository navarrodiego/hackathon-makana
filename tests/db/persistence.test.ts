import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import { BASE_FIXTURE, ACCEPTED_FIXTURE, INCIDENT_FIXTURE, OUTGOING_ELIGIBLE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import type { CommandContext } from '../../src/lib/contracts/auth';
import type { PreparedExecution } from '../../src/lib/contracts/services';
import type { TransactionRepositories } from '../../src/lib/contracts/repositories';
import type { ServiceResult } from '../../src/lib/contracts/http';
import type { Report } from '../../src/lib/contracts/domain';
import { randomUUID } from 'node:crypto';
config({ path: '.env.t03', quiet: true });
const context = (p: PreparedExecution): CommandContext => ({ executionId: p.executionId, executionVersion: p.version, principal: { kind: 'system' }, actorId: null, origin: 'system', operationalNow: BASE_FIXTURE.operationalAt, narrativeNow: BASE_FIXTURE.narrativeAt, correlationId: 'correlation_db_test' });
const success = <T>(value: T) => ({ ok: true as const, value });
async function checked<T>(store: PostgresPersistence, c: CommandContext, fn: (r: TransactionRepositories) => Promise<ServiceResult<T>>): Promise<void> { const result = await store.run(c, fn); assert.ok(result.ok, JSON.stringify(result)); }
function report(p: PreparedExecution, seq: number): Report {
  return { id: `report_${randomUUID()}`, executionId: p.executionId, version: 1, sessionId: p.sessionId, admissionSequence: seq, nickname: 'Prueba', text: 'Local 1 sin red', origin: 'web', operationalAt: BASE_FIXTURE.operationalAt, narrativeAt: BASE_FIXTURE.narrativeAt, correlationId: 'correlation_report', principalKey: 'session:test', idempotencyKey: `report-${seq}`, status: 'processing', classification: null, decision: null, incidentId: null };
}

test('fixtures aislados, rollback, CAS, cuotas, equivalencia y reset en PostgreSQL', async t => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!;
  const db = localClient(url); const preparer = fixturePreparer(db, url); const store = new PostgresPersistence(db);
  try {
    await t.test('remapea IDs y materializa los cuatro fixtures sin generación de nota', async () => {
      const seen = new Set<string>();
      for (const f of [BASE_FIXTURE, ACCEPTED_FIXTURE, INCIDENT_FIXTURE, OUTGOING_ELIGIBLE_FIXTURE]) {
        const p = await preparer.prepare(f);
        try {
          assert.ok(!seen.has(p.executionId)); seen.add(p.executionId);
          assert.notEqual(p.handoff.outgoingActorId, 'actor_outgoing'); assert.equal(p.handoff.savedSuggestion, null);
          const result = await store.run(context(p), async r => {
            assert.equal((await r.aggregates.tickets.list()).length, 5);
            assert.equal((await r.reference.actors()).length, 4);
            if (f === INCIDENT_FIXTURE) assert.equal((await r.aggregates.incidents.list()).length, 1);
            return success(null);
          }); assert.deepEqual(result, success(null));
        } finally { await preparer.dispose(p.executionId); }
      }
    });
    const p = await preparer.prepare(BASE_FIXTURE); const c = context(p);
    try {
      await t.test('ok:false y una excepción revierten entidad y evento', async () => {
        for (const throws of [false, true]) {
          const result = await store.run(c, async r => {
            const h = (await r.aggregates.handoffs.get(p.handoff.id))!;
            await r.aggregates.handoffs.compareAndSwap({ ...h, note: 'No debe guardarse', version: h.version + 1 }, { executionId: p.executionId, version: h.version, status: h.status, currentAttemptId: h.currentAttemptId });
            await r.events.append({ executionId: p.executionId, kind: 'scene_changed', entity: { kind: 'execution', id: p.executionId }, entityVersion: 1, actorId: null, principal: { kind: 'system' }, origin: 'system', channel: 'system', details: { kind: 'record' }, operationalAt: c.operationalNow, narrativeAt: c.narrativeNow, correlationId: c.correlationId, result: 'recorded' });
            if (throws) throw new Error('controlled failure'); return { ok: false, code: 'STATE_CONFLICT' };
          }); assert.equal(result.ok, false);
          await checked(store, c, async r => { assert.equal((await r.aggregates.handoffs.get(p.handoff.id))!.note, ''); assert.equal((await r.events.list()).length, 0); return success(null); });
        }
      });
      await t.test('dos CAS con la misma versión producen un solo ganador', async () => {
        const outcomes = await Promise.all(['uno', 'dos'].map(note => store.run(c, async r => success(await r.aggregates.handoffs.compareAndSwap({ ...p.handoff, note, version: 2 }, { executionId: p.executionId, version: 1, status: 'draft', currentAttemptId: null })))));
        assert.equal(outcomes.filter(x => x.ok && x.value).length, 1);
      });
      await t.test('reserva idempotente única y respuesta inmutable', async () => {
        const record = { executionId: p.executionId, principalKey: 'system', operation: 'POST /api/handoff' as const, key: 'same', fingerprint: 'a'.repeat(64), createdAt: c.operationalNow, status: 'pending' as const, response: null, successorExecutionId: null };
        const results = await Promise.all([1, 2].map(() => store.run(c, async r => success(await r.idempotency.reserve(record)))));
        assert.equal(results.filter(x => x.ok && x.value.inserted).length, 1);
        const saved = { route: 'POST /api/handoff' as const, response: { status: 409 as const, body: { ok: false as const, error: { code: 'STATE_CONFLICT' as const, message: 'Conflicto' }, correlationId: c.correlationId } } };
        assert.equal((await store.run(c, async r => { await r.idempotency.complete(record, saved); return success(null); })).ok, true);
        assert.equal((await store.run(c, async r => { await r.idempotency.complete(record, saved); return success(null); })).ok, false);
        await checked(store, c, async r => { const replay = await r.idempotency.reserve(record); assert.deepEqual(replay.record.status, 'completed'); assert.equal(replay.inserted, false); return success(null); });
      });
      await t.test('seis ingresos concurrentes admiten cinco; el sexto no reserva ni inserta', async () => {
        const results = await Promise.all(Array.from({ length: 6 }, () => store.run(c, async r => {
          const q = await r.reserveReportQuota(p.sessionId); if (!q.ok) return q;
          await r.aggregates.reports.insert(report(p, q.value.admissionSequence)); return success(q.value.admissionSequence);
        })));
        assert.deepEqual(results.filter(x => x.ok).map(x => x.ok ? x.value : 0).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
        assert.equal(results.filter(x => !x.ok && x.code === 'QUOTA_EXCEEDED').length, 1);
        await checked(store, c, async r => { assert.equal((await r.reportsAwaitingDecision()).length, 5); return success(null); });
      });
      await t.test('FK y referencias de arrays rechazan entidades de otra ejecución', async () => {
        const result = await store.run(c, async r => {
          const h = (await r.aggregates.handoffs.get(p.handoff.id))!;
          await r.aggregates.handoffs.compareAndSwap({ ...h, version: h.version + 1, ticketIds: ['ticket_other_execution'] }, { executionId: p.executionId, version: h.version, status: h.status, currentAttemptId: h.currentAttemptId }); return success(null);
        }); assert.deepEqual(result, { ok: false, code: 'STORAGE_UNAVAILABLE' });
      });
    } finally { await preparer.dispose(p.executionId); }
  } finally { await db.$disconnect(); }
});
