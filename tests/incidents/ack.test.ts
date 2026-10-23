import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, factsKey, world } from './helpers';

const NOW = ACCEPTED_FIXTURE.operationalAt;
const N = '2026-10-24T01:10:01.000Z' as const;
type W = Awaited<ReturnType<typeof world>>;

async function open(w: W) {
  const r = await w.ingest(factsKey('no emite boletas'), NOW, N); assert.ok(r.ok && r.value.incident);
  return w.snapshot();
}
const body = (w: W, s: Awaited<ReturnType<W['snapshot']>>, key: string, index = s.attempts.length - 1) =>
  ({ executionId: w.prepared.executionId, idempotencyKey: key, expectedVersion: s.incidents[0].version, attemptId: s.attempts[index].id });

test('tomar detiene la escalada pero no resuelve ni cambia la cobertura ni el relevo (I01)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const s = await open(w);
    const r = await w.service.take(w.recipient(w.ids.Paula, at(NOW, 10_000), N), s.incidents[0].id, body(w, s, 'ack'));
    assert.ok(r.ok); assert.equal(r.value.incident.status, 'taken'); assert.equal(r.value.incident.takenBy?.id, w.ids.Paula);
    const a = await w.snapshot();
    assert.equal(a.incidents[0].status, 'taken');
    assert.equal(a.attempts[0].status, 'accepted');
    assert.deepEqual(a.coverage, s.coverage);
    assert.deepEqual(a.handoff, s.handoff);
    assert.ok(a.events.some(e => e.kind === 'incident_taken' && e.result === 'taken'));
    // Pasado el plazo original no hay escalada.
    const later = await w.service.evaluateDeadlines(w.system(at(NOW, 31_000), N));
    assert.ok(later.ok); assert.deepEqual(later.value, []);
    assert.equal((await w.snapshot()).attempts.length, 1);
  } finally { await w.close(); }
});

test('acuse tardío no reasigna; otro destinatario o entidad es rechazado (I03, S01)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const s = await open(w);
    const late = await w.service.take(w.recipient(w.ids.Paula, at(NOW, 30_000), N), s.incidents[0].id, body(w, s, 'late'));
    assert.deepEqual(late, { ok: false, code: 'ACTION_EXPIRED' });
    const other = await w.service.take(w.recipient(w.ids.Tomás, at(NOW, 1_000), N), s.incidents[0].id, body(w, s, 'other'));
    assert.deepEqual(other, { ok: false, code: 'FORBIDDEN' });
    const wrongEntity = await w.service.take(w.recipient(w.ids.Paula, at(NOW, 1_000), N), 'incident_nope' as never, body(w, s, 'wrong'));
    assert.deepEqual(wrongEntity, { ok: false, code: 'NOT_FOUND' });
    const a = await w.snapshot();
    assert.equal(a.incidents[0].status, 'awaiting_ack'); assert.equal(a.incidents[0].takenBy, null);
  } finally { await w.close(); }
});

test('vence, escala a respaldo con 30 s completos propios y el acuse del primero ya no reasigna (I02, I03)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const s = await open(w);
    const t1 = at(NOW, 30_000);
    const ev = await w.service.evaluateDeadlines(w.system(t1, N));
    assert.ok(ev.ok); assert.deepEqual(ev.value, [s.incidents[0].id]);
    const a = await w.snapshot();
    assert.equal(a.attempts.length, 2);
    assert.equal(a.attempts[0].status, 'expired');
    assert.equal(a.attempts[1].candidateActorId, w.ids.Tomás);
    assert.equal(a.attempts[1].requestedAt, t1);
    assert.equal(a.attempts[1].deadlineAt, at(t1, 30_000));
    assert.equal(a.incidents[0].currentAttemptId, a.attempts[1].id);
    assert.equal(a.notifications.filter(n => n.subject.kind === 'incident').length, 2);
    assert.ok(a.events.some(e => e.kind === 'incident_escalated'));
    // Reevaluar no duplica.
    const again = await w.service.evaluateDeadlines(w.system(at(t1, 1), N));
    assert.ok(again.ok); assert.deepEqual(again.value, []);
    // Acuse tardío de Paula sobre el intento viejo: no reasigna silenciosamente.
    const old = await w.service.take(w.recipient(w.ids.Paula, at(t1, 2), N), a.incidents[0].id, { executionId: w.prepared.executionId, idempotencyKey: 'old', expectedVersion: a.incidents[0].version, attemptId: a.attempts[0].id });
    assert.deepEqual(old, { ok: false, code: 'CANDIDATE_STALE' });
    // Tomás sí puede.
    const ok = await w.service.take(w.recipient(w.ids.Tomás, at(t1, 5_000), N, 'web'), a.incidents[0].id, { executionId: w.prepared.executionId, idempotencyKey: 'tomas', expectedVersion: a.incidents[0].version, attemptId: a.attempts[1].id });
    assert.ok(ok.ok); assert.equal(ok.value.incident.takenBy?.id, w.ids.Tomás);
  } finally { await w.close(); }
});

test('sin más candidatos: sin acuse y aviso a coordinación, sin extender a nadie (I02, R09)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    await open(w);
    await w.service.evaluateDeadlines(w.system(at(NOW, 30_000), N));
    const ev = await w.service.evaluateDeadlines(w.system(at(NOW, 60_000), N));
    assert.ok(ev.ok); assert.equal(ev.value.length, 1);
    const a = await w.snapshot();
    assert.equal(a.incidents[0].status, 'unacknowledged'); assert.equal(a.incidents[0].currentAttemptId, null);
    assert.equal(a.attempts.length, 2);
    const coord = a.notifications.filter(n => n.subject.kind === 'coordination');
    assert.equal(coord.length, 1); assert.equal(coord[0].recipientActorId, w.ids.Carla);
    assert.ok(a.events.some(e => e.kind === 'incident_unacknowledged'));
  } finally { await w.close(); }
});

test('carreras acuse / vencimiento / doble acuse dejan un único resultado consistente (I03)', async () => {
  for (let round = 0; round < 4; round++) {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const s = await open(w);
      const t = at(NOW, 29_000);
      const [a1, a2, ev] = await Promise.all([
        w.service.take(w.recipient(w.ids.Paula, t, N), s.incidents[0].id, body(w, s, 'a1')),
        w.service.take(w.recipient(w.ids.Paula, t, N), s.incidents[0].id, body(w, s, 'a2')),
        w.service.evaluateDeadlines(w.system(at(NOW, 30_000), N)),
      ]);
      const a = await w.snapshot();
      const takes = [a1, a2].filter(r => r.ok).length;
      assert.equal(takes, 1, `un solo acuse gana (ronda ${round})`);
      assert.equal(a.incidents[0].status, 'taken');
      assert.equal(a.events.filter(e => e.kind === 'incident_taken').length, 1);
      assert.equal(a.attempts.filter(x => x.status === 'pending').length, 0);
      assert.equal(a.attempts.length, 1, 'el acuse ganó antes del vencimiento: no hay escalada');
      void ev;
    } finally { await w.close(); }
  }
});

test('replay con la misma clave devuelve el resultado original; contenido distinto es 409', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const s = await open(w);
    const first = await w.service.take(w.recipient(w.ids.Paula, at(NOW, 1_000), N), s.incidents[0].id, body(w, s, 'same'));
    const replay = await w.service.take(w.recipient(w.ids.Paula, at(NOW, 2_000), N), s.incidents[0].id, body(w, s, 'same'));
    assert.ok(first.ok && replay.ok); assert.deepEqual(replay.value, first.value);
    assert.equal((await w.snapshot()).events.filter(e => e.kind === 'incident_taken').length, 1);
    const conflict = await w.service.take(w.recipient(w.ids.Paula, at(NOW, 3_000), N), s.incidents[0].id, { ...body(w, s, 'same'), expectedVersion: 99 });
    assert.deepEqual(conflict, { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  } finally { await w.close(); }
});

test('control representa al candidato con origen escenario (S01)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const s = await open(w);
    const r = await w.service.take(w.control(w.ids.Paula, at(NOW, 1_000), N), s.incidents[0].id, body(w, s, 'ctl'));
    assert.ok(r.ok);
    const ev = (await w.snapshot()).events.find(e => e.kind === 'incident_taken')!;
    assert.equal(ev.origin, 'scenario');
  } finally { await w.close(); }
});
