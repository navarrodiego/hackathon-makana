import assert from 'node:assert/strict';
import { LIMITS } from '../../src/lib/contracts/core';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Report } from '../../src/lib/contracts/domain';
import { at, world } from './helpers';

const AWAITING = { ...BASE_FIXTURE, name: 'awaiting', handoffState: 'awaiting_candidate' } as const;
const SECRET_KEYS = ['credentialHash', 'token', 'topic', 'opaqueToken', 'idempotencyKey', 'principalKey', 'details'];
const leaks = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(leaks);
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => [...(SECRET_KEYS.includes(k) ? [k] : []), ...leaks(v)]);
  return [];
};

test('lecturas privadas autorizadas (S04/S05)', async t => {
  await t.test('Rodrigo ve su borrador y nota guardada; otro actor no', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const view = await w.read.outgoing(w.ctx({ kind: 'outgoing', actorId: w.ids.Rodrigo }, w.ids.Rodrigo, BASE_FIXTURE.operationalAt));
      assert.ok(view.ok, JSON.stringify(view));
      assert.equal(view.value.audience, 'outgoing');
      assert.equal(view.value.tickets.length, BASE_FIXTURE.tickets.length);
      assert.equal(view.value.handoff, null);
      assert.equal(view.value.note.saved, null);
      assert.deepEqual(leaks(view.value), []);
      const other = await w.read.outgoing(w.ctx({ kind: 'outgoing', actorId: w.ids.Paula }, w.ids.Paula, BASE_FIXTURE.operationalAt));
      assert.deepEqual(other, { ok: false, code: 'FORBIDDEN' });
      const reporter = await w.read.outgoing(w.ctx({ kind: 'reporter', sessionId: w.prepared.sessionId }, null, BASE_FIXTURE.operationalAt));
      assert.deepEqual(reporter, { ok: false, code: 'FORBIDDEN' });
    } finally { await w.close(); }
  });

  await t.test('la nota guardada pasa a ready aunque la preparación del reset haya fallado', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const prepared = await w.note.prepare(w.control());
      assert.ok(prepared.ok);
      const view = await w.read.outgoing(w.ctx({ kind: 'outgoing', actorId: w.ids.Rodrigo }, w.ids.Rodrigo, BASE_FIXTURE.operationalAt));
      assert.ok(view.ok);
      assert.equal(view.value.note.status, 'ready');
      assert.ok(view.value.note.saved?.output.note);
    } finally { await w.close(); }
  });

  await t.test('el destinatario vigente ve el paquete; el derivado, un relevo ajeno o un borrador no filtran nada', async () => {
    const w = await world(AWAITING);
    try {
      const paula = w.ctx({ kind: 'recipient', actorId: w.ids.Paula, grant: {} as never }, w.ids.Paula, AWAITING.operationalAt, undefined, undefined, 'ntfy_action');
      const view = await w.read.recipient(paula, w.prepared.handoff.id);
      assert.ok(view.ok, JSON.stringify(view));
      assert.equal(view.value.audience, 'recipient');
      assert.equal(view.value.tickets.length, BASE_FIXTURE.tickets.length);
      assert.deepEqual(leaks(view.value), []);
      const wrongId = await w.read.recipient(paula, 'handoff_otro');
      assert.deepEqual(wrongId, { ok: false, code: 'NOT_FOUND' });
      const tomas = w.ctx({ kind: 'recipient', actorId: w.ids.Tomás, grant: {} as never }, w.ids.Tomás, AWAITING.operationalAt);
      const denied = await w.read.recipient(tomas, w.prepared.handoff.id);
      assert.deepEqual(denied, { ok: false, code: 'CANDIDATE_STALE' });
      assert.equal('value' in denied, false);
      // Tras vencer Paula, su enlace deja de abrir el paquete.
      w.setNow(at(AWAITING.operationalAt, 31_000));
      assert.ok((await w.execution.evaluate(w.system())).ok);
      const late = await w.read.recipient(paula, w.prepared.handoff.id);
      assert.deepEqual(late, { ok: false, code: 'CANDIDATE_STALE' });
    } finally { await w.close(); }
  });

  await t.test('un relevo en borrador no se muestra al destinatario', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const paula = w.ctx({ kind: 'recipient', actorId: w.ids.Paula, grant: {} as never }, w.ids.Paula, BASE_FIXTURE.operationalAt);
      assert.deepEqual(await w.read.recipient(paula, w.prepared.handoff.id), { ok: false, code: 'NOT_FOUND' });
    } finally { await w.close(); }
  });

  await t.test('control ve opciones de escena y actores; nadie más', async () => {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const view = await w.read.control(w.control());
      assert.ok(view.ok);
      assert.equal(view.value.sceneOptions.length, BASE_FIXTURE.scenes.length);
      assert.equal(view.value.representedActors.length, 4);
      assert.deepEqual(leaks(view.value), []);
      assert.deepEqual(await w.read.control(w.system()), { ok: false, code: 'FORBIDDEN' });
    } finally { await w.close(); }
  });

  await t.test('el canal muestra solo los reportes de la propia sesión y los cupos restantes', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const sessions = [w.prepared.sessionId, `session_${randomUUID()}` as const];
      await w.db.$executeRaw`INSERT INTO report_sessions (id,"credentialHash","expiresAt") VALUES (${sessions[1]}, ${createHash('sha256').update(randomUUID()).digest('hex')}, now() + interval '1 hour')`;
      for (const [i, sessionId] of sessions.entries()) {
        await w.store.run(w.system(), async tx => {
          const q = await tx.reserveReportQuota(sessionId); if (!q.ok) return q;
          const report: Report = { id: `report_${randomUUID()}`, executionId: w.prepared.executionId, version: 1, admissionSequence: q.value.admissionSequence, sessionId,
            nickname: 'Prueba', text: `Reporte ${i}`, origin: 'web', operationalAt: BASE_FIXTURE.operationalAt, narrativeAt: BASE_FIXTURE.narrativeAt,
            correlationId: 'correlation_x', principalKey: `session:${sessionId}`, idempotencyKey: `k-${i}`, status: 'processing', classification: null, decision: null, incidentId: null };
          await tx.aggregates.reports.insert(report);
          return { ok: true, value: null };
        });
      }
      const view = await w.read.ownReports(w.ctx({ kind: 'reporter', sessionId: sessions[0] }, null, BASE_FIXTURE.operationalAt));
      assert.ok(view.ok, JSON.stringify(view));
      assert.equal(view.value.ownReports.length, 1);
      assert.equal(view.value.ownReports[0].status, 'processing');
      assert.equal(view.value.ownReports[0].classificationMode, 'pending');
      assert.equal(view.value.remainingSessionReports, 4);
      assert.equal(view.value.remainingExecutionReports, LIMITS.reportsPerExecution - 2);
      assert.equal(view.value.channelOpen, false);
      assert.deepEqual(await w.read.ownReports(w.control()), { ok: false, code: 'FORBIDDEN' });
    } finally { await w.close(); await w.db.$executeRaw`DELETE FROM report_sessions`.catch(() => undefined); }
  });
});
