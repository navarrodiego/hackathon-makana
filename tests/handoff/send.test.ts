import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, world } from './helpers';

const NOW = BASE_FIXTURE.operationalAt;
const words = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`).join(' ');

async function sendInput(w: Awaited<ReturnType<typeof world>>, over: Record<string, unknown> = {}) {
  const s = await w.snapshot();
  return {
    executionId: w.prepared.executionId, idempotencyKey: 'send-1', expectedVersion: s.handoff.version, handoffId: s.handoff.id,
    note: 'Revisar el respaldo #470 a las 02:00.',
    tickets: s.tickets.map(t => ({ ticketId: t.id, disposition: t.reference === '#470' ? 'transferir' as const : 'puede_esperar' as const, reason: 'Corregido por Rodrigo.' })),
    ...over,
  };
}

test('enviar crea el primer intento de 30 s, no activa cobertura y registra evento e intención (R01)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const r = await w.service.send(w.outgoing(NOW), await sendInput(w));
    assert.ok(r.ok, JSON.stringify(r));
    const s = await w.snapshot();
    assert.equal(s.handoff.status, 'awaiting_candidate');
    assert.equal(s.attempts.length, 1);
    assert.equal(s.attempts[0].candidateActorId, w.ids.Paula);
    assert.equal(s.attempts[0].deadlineAt, at(NOW, 30_000));
    assert.equal(s.handoff.sentAt, NOW);
    assert.equal(s.coverage.status, 'unconfirmed', 'enviar no confirma cobertura');
    assert.equal(r.value.coverage.status, 'unconfirmed');
    assert.equal(r.value.handoff.status, 'awaiting_candidate');
    assert.equal(r.value.handoff.candidate?.displayName, 'Paula');
    assert.ok(s.tickets.every(t => t.reason === 'Corregido por Rodrigo.'), 'correcciones humanas persistidas');
    assert.equal(s.tickets.find(t => t.reference === '#470')!.disposition, 'transferir');
    assert.deepEqual(s.events.map(e => e.kind), ['handoff_sent', 'notification_intended']);
    assert.equal(s.notifications.length, 1);
    assert.equal(s.notifications[0].recipientActorId, w.ids.Paula);
    assert.equal(s.notifications[0].status, 'pending');
    assert.equal(s.coverage.actorId, null);
  } finally { await w.close(); }
});

test('el mismo envío con la misma clave devuelve la respuesta original sin repetir intento, evento ni aviso', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const input = await sendInput(w);
    const first = await w.service.send(w.outgoing(NOW), input);
    const replay = await w.service.send(w.outgoing(at(NOW, 5_000)), input);
    assert.deepEqual(replay, first);
    const s = await w.snapshot();
    assert.equal(s.attempts.length, 1); assert.equal(s.events.length, 2); assert.equal(s.notifications.length, 1);
    const clash = await w.service.send(w.outgoing(NOW), { ...input, note: 'Otra nota distinta.' });
    assert.deepEqual(clash, { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  } finally { await w.close(); }
});

test('rechazos de envío no dejan ningún cambio', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const base = await sendInput(w);
    const before = await w.snapshot();
    const cases: [string, Parameters<typeof w.service.send>[0], Record<string, unknown>, string][] = [
      ['versión vieja', w.outgoing(NOW), { expectedVersion: 99, idempotencyKey: 'k1' }, 'VERSION_CONFLICT'],
      ['faltan tickets', w.outgoing(NOW), { tickets: base.tickets.slice(1), idempotencyKey: 'k2' }, 'INVALID_INPUT'],
      ['ticket repetido', w.outgoing(NOW), { tickets: [...base.tickets.slice(1), base.tickets[1]], idempotencyKey: 'k3' }, 'INVALID_INPUT'],
      ['ticket ajeno', w.outgoing(NOW), { tickets: [...base.tickets.slice(1), { ...base.tickets[0], ticketId: 'ticket_ajeno' }], idempotencyKey: 'k4' }, 'INVALID_INPUT'],
      ['nota de 61 palabras', w.outgoing(NOW), { note: words(61), idempotencyKey: 'k5' }, 'INVALID_INPUT'],
      ['razón vacía', w.outgoing(NOW), { tickets: base.tickets.map(t => ({ ...t, reason: '  ' })), idempotencyKey: 'k6' }, 'INVALID_INPUT'],
      ['quien no es el saliente', w.ctx({ kind: 'recipient', actorId: w.ids.Paula, grant: {} as never }, w.ids.Paula, NOW), { idempotencyKey: 'k7' }, 'FORBIDDEN'],
      ['control representando a otro', w.control(w.ids.Paula, NOW), { idempotencyKey: 'k8' }, 'FORBIDDEN'],
    ];
    for (const [name, context, over, code] of cases) {
      assert.deepEqual(await w.service.send(context, { ...base, ...over }), { ok: false, code }, name);
    }
    const after = await w.snapshot();
    assert.deepEqual(after, before);
    const ok = await w.service.send(w.outgoing(NOW), { ...base, note: words(60), idempotencyKey: 'k9' });
    assert.ok(ok.ok, 'exactamente 60 palabras se admite');
    assert.deepEqual(await w.service.send(w.outgoing(NOW), { ...base, idempotencyKey: 'k10', expectedVersion: (await w.snapshot()).handoff.version }), { ok: false, code: 'STATE_CONFLICT' });
  } finally { await w.close(); }
});

test('control puede enviar representando al saliente y deja origen escenario', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const r = await w.service.send(w.control(w.ids.Rodrigo, NOW), await sendInput(w));
    assert.ok(r.ok);
    const s = await w.snapshot();
    assert.deepEqual(s.events.map(e => [e.kind, e.origin, e.principal.kind]), [['handoff_sent', 'scenario', 'control'], ['notification_intended', 'scenario', 'control']]);
  } finally { await w.close(); }
});
