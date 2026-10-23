import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { at, world } from './helpers';

const NOW = BASE_FIXTURE.operationalAt;
const BEFORE: Instant = '2026-10-24T01:09:50.000Z';
type W = Awaited<ReturnType<typeof world>>;

async function sent(w: W) {
  const s = await w.snapshot();
  const r = await w.service.send(w.outgoing(NOW), { executionId: w.prepared.executionId, idempotencyKey: 'send', expectedVersion: s.handoff.version, handoffId: s.handoff.id, note: 'Nota.',
    tickets: s.tickets.map(t => ({ ticketId: t.id, disposition: t.disposition, reason: 'Revisado.' })) });
  assert.ok(r.ok); return w.snapshot();
}
const paula = (w: W, now: Instant) => w.ctx({ kind: 'recipient', actorId: w.ids.Paula, grant: {} as never }, w.ids.Paula, now, BEFORE, 'ntfy_action');
const terminal = ['handoff_accepted', 'handoff_rejected', 'handoff_expired'];

test('aceptar, rechazar y vencer a la vez producen una sola transición válida (R07)', async () => {
  for (let round = 0; round < 3; round++) {
    const w = await world(BASE_FIXTURE);
    try {
      const s = await sent(w);
      const base = { executionId: w.prepared.executionId, expectedVersion: s.handoff.version, attemptId: s.attempts[0].id };
      const results = await Promise.all([
        w.service.accept(paula(w, at(NOW, 29_000)), s.handoff.id, { ...base, idempotencyKey: 'acc' }),
        w.service.reject(paula(w, at(NOW, 29_000)), s.handoff.id, { ...base, idempotencyKey: 'rej' }),
        w.service.evaluateDeadlines(w.ctx({ kind: 'system' }, null, at(NOW, 30_000), BEFORE, 'system')),
        w.service.accept(paula(w, at(NOW, 29_500)), s.handoff.id, { ...base, idempotencyKey: 'acc2' }),
      ]);
      const a = await w.snapshot();
      const outcome = JSON.stringify(results.map(r => (r.ok ? 'ok' : r.code)));
      const first = a.events.filter(e => terminal.includes(e.kind));
      assert.equal(first.length, 1, `una sola transición del intento 0 (ronda ${round}): ${first.map(e => e.kind)} ${outcome}`);
      assert.equal(a.attempts.filter(x => x.status === 'pending').length, a.handoff.status === 'awaiting_candidate' ? 1 : 0, outcome);
      assert.equal(a.attempts[0].status, { handoff_accepted: 'accepted', handoff_rejected: 'rejected', handoff_expired: 'expired' }[first[0].kind as 'handoff_accepted']);
      const accepted = results.slice(0, 2).concat(results[3]).filter(r => r.ok && 'handoff' in r.value && r.value.handoff.status === 'accepted');
      if (a.handoff.status === 'accepted') { assert.equal(a.attempts.length, 1); assert.ok(accepted.length >= 1); }
      else assert.equal(accepted.length, 0, `nadie recibió éxito de aceptación si no quedó aceptado ${outcome}`);
      assert.equal(a.notifications.filter(n => n.subject.kind === 'handoff').length, a.attempts.length, 'un aviso lógico por intento');
    } finally { await w.close(); }
  }
});

test('doble clic con la misma clave: ambos reciben lo mismo y hay un solo evento', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const input = { executionId: w.prepared.executionId, expectedVersion: s.handoff.version, attemptId: s.attempts[0].id, idempotencyKey: 'dbl' };
    const [x, y] = await Promise.all([
      w.service.accept(paula(w, at(NOW, 5_000)), s.handoff.id, input),
      w.service.accept(paula(w, at(NOW, 5_001)), s.handoff.id, input),
    ]);
    assert.ok(x.ok && y.ok); assert.deepEqual(x, y);
    assert.equal((await w.snapshot()).events.filter(e => e.kind === 'handoff_accepted').length, 1);
  } finally { await w.close(); }
});
