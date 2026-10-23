import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, OUTGOING_ELIGIBLE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, factsKey, world } from './helpers';

const NOW = ACCEPTED_FIXTURE.operationalAt;
const N = '2026-10-24T01:10:01.000Z' as const;

test('cambiar la hora narrativa no acelera el plazo del incidente (I06)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    await w.ingest(factsKey('no emite boletas'), NOW, N);
    const ev = await w.service.evaluateDeadlines(w.system(at(NOW, 5_000), '2026-10-24T09:00:00.000Z'));
    assert.ok(ev.ok); assert.deepEqual(ev.value, []);
    const s = await w.snapshot(); assert.equal(s.attempts.length, 1); assert.equal(s.attempts[0].status, 'pending');
  } finally { await w.close(); }
});

test('evaluadores concurrentes no duplican la escalada (I07)', async () => {
  for (let round = 0; round < 3; round++) {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      await w.ingest(factsKey('no emite boletas'), NOW, N);
      const t = at(NOW, 31_000);
      await Promise.all([1, 2, 3, 4].map(() => w.service.evaluateDeadlines(w.system(t, N))));
      const s = await w.snapshot();
      assert.equal(s.attempts.length, 2, `ronda ${round}`);
      assert.equal(s.events.filter(e => e.kind === 'incident_escalated').length, 1);
      assert.equal(s.notifications.filter(n => n.subject.kind === 'incident').length, 2);
    } finally { await w.close(); }
  }
});

test('retomar tras una pausa evalúa lo vencido una sola vez (I07)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    await w.ingest(factsKey('no emite boletas'), NOW, N);
    const first = await w.service.evaluateDeadlines(w.system(at(NOW, 600_000), N));
    assert.ok(first.ok && first.value.length === 1);
    const s = await w.snapshot();
    assert.equal(s.attempts[1].requestedAt, at(NOW, 600_000), 'el plazo nuevo parte de la solicitud real');
  } finally { await w.close(); }
});

test('elegibilidad por ventana/rol: Rodrigo sí escala si es respaldo explícito (R08)', async () => {
  const w = await world({ ...OUTGOING_ELIGIBLE_FIXTURE, handoffState: 'accepted', acceptedBy: 'actor_incoming', narrativeAt: N });
  try {
    await w.ingest(factsKey('no emite boletas'), NOW, N);
    await w.service.evaluateDeadlines(w.system(at(NOW, 30_000), N));
    const s = await w.snapshot();
    assert.equal(s.attempts[1].candidateActorId, w.ids.Rodrigo);
  } finally { await w.close(); }
});
