import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_FIXTURE, OUTGOING_ELIGIBLE_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { at, world } from './helpers';

const NOW = BASE_FIXTURE.operationalAt;
const BEFORE: Instant = '2026-10-24T01:09:50.000Z';
const INSIDE: Instant = '2026-10-24T01:10:05.000Z';
type W = Awaited<ReturnType<typeof world>>;

async function sent(w: W) {
  const s = await w.snapshot();
  const r = await w.service.send(w.outgoing(NOW), {
    executionId: w.prepared.executionId, idempotencyKey: 'send', expectedVersion: s.handoff.version, handoffId: s.handoff.id, note: 'Nota.',
    tickets: s.tickets.map(t => ({ ticketId: t.id, disposition: t.disposition, reason: 'Revisado.' })),
  });
  assert.ok(r.ok); return (await w.snapshot());
}
const respond = (w: W, who: 'Paula' | 'Tomás' | 'Rodrigo', s: Awaited<ReturnType<W['snapshot']>>, key: string, attemptIndex = s.attempts.length - 1) => ({
  executionId: w.prepared.executionId, idempotencyKey: key, expectedVersion: s.handoff.version, attemptId: s.attempts[attemptIndex].id,
});
const paula = (w: W, now: Instant, narrative?: Instant) => w.ctx({ kind: 'recipient', actorId: w.ids.Paula, grant: {} as never }, w.ids.Paula, now, narrative, 'ntfy_action');
const tomas = (w: W, now: Instant, narrative?: Instant) => w.ctx({ kind: 'recipient', actorId: w.ids.Tomás, grant: {} as never }, w.ids.Tomás, now, narrative);

test('aceptar antes de la ventana programa la cobertura sin activarla (R02)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const r = await w.service.accept(paula(w, at(NOW, 10_000), BEFORE), s.handoff.id, respond(w, 'Paula', s, 'a1'));
    assert.ok(r.ok, JSON.stringify(r));
    const a = await w.snapshot();
    assert.equal(a.handoff.status, 'accepted'); assert.equal(a.handoff.acceptedAt, at(NOW, 10_000)); assert.equal(a.handoff.acceptedBy, w.ids.Paula);
    assert.equal(a.handoff.effectiveAt, BASE_FIXTURE.window.startsAt);
    assert.equal(a.coverage.status, 'scheduled'); assert.equal(a.coverage.actorId, w.ids.Paula);
    assert.equal(a.attempts[0].status, 'accepted');
    assert.equal(r.value.coverage.status, 'scheduled');
    assert.ok(!a.events.some(e => e.kind === 'coverage_activated'), 'no hay cobertura activa antes de la ventana');
    assert.equal(a.events.at(-1)!.origin, 'ntfy_action');
    assert.equal(a.notifications.length, 1, 'aceptar no genera otro aviso ni incidente');
  } finally { await w.close(); }
});

test('aceptar dentro de la ventana activa la cobertura al instante', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const r = await w.service.accept(paula(w, at(NOW, 10_000), INSIDE), s.handoff.id, respond(w, 'Paula', s, 'a1'));
    assert.ok(r.ok);
    const a = await w.snapshot();
    assert.equal(a.coverage.status, 'active');
    assert.deepEqual(a.events.slice(-2).map(e => e.kind), ['handoff_accepted', 'coverage_activated']);
  } finally { await w.close(); }
});

test('rechazar deriva de inmediato a Tomás con 30 s completos (R03)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const r = await w.service.reject(paula(w, at(NOW, 2_000)), s.handoff.id, respond(w, 'Paula', s, 'r1'));
    assert.ok(r.ok, JSON.stringify(r));
    const a = await w.snapshot();
    assert.deepEqual(a.attempts.map(x => [x.candidateActorId, x.status]), [[w.ids.Paula, 'rejected'], [w.ids.Tomás, 'pending']]);
    assert.equal(a.attempts[1].deadlineAt, at(NOW, 32_000));
    assert.equal(a.handoff.status, 'awaiting_candidate'); assert.equal(a.handoff.currentAttemptId, a.attempts[1].id);
    assert.equal(a.coverage.status, 'unconfirmed');
    assert.equal(r.value.handoff.candidate?.displayName, 'Tomás');
    assert.deepEqual(a.events.slice(-3).map(e => e.kind), ['handoff_rejected', 'handoff_derived', 'notification_intended']);
    const tomasNotice = a.notifications.find(n => n.recipientActorId === w.ids.Tomás)!;
    assert.equal(tomasNotice.channel, 'in_app');
  } finally { await w.close(); }
});

test('el silencio de Paula deriva solo al vencer y Tomás recibe sus propios 30 s (R04)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    await sent(w);
    const ctxSystem = (now: Instant) => w.ctx({ kind: 'system' }, null, now, BEFORE, 'system');
    assert.deepEqual(await w.service.evaluateDeadlines(ctxSystem(at(NOW, 29_999))), { ok: true, value: [] });
    assert.equal((await w.snapshot()).attempts.length, 1, 'un milisegundo antes no deriva');
    const r = await w.service.evaluateDeadlines(ctxSystem(at(NOW, 30_000)));
    assert.ok(r.ok && r.value.length === 1);
    const a = await w.snapshot();
    assert.deepEqual(a.attempts.map(x => x.status), ['expired', 'pending']);
    assert.equal(a.attempts[1].requestedAt, at(NOW, 30_000)); assert.equal(a.attempts[1].deadlineAt, at(NOW, 60_000));
    assert.deepEqual(a.events.slice(-3).map(e => e.kind), ['handoff_expired', 'handoff_derived', 'notification_intended']);
    const again = await w.service.evaluateDeadlines(ctxSystem(at(NOW, 30_001)));
    assert.deepEqual(again, { ok: true, value: [] }, 'repetir la evaluación no duplica la derivación');
    assert.equal((await w.snapshot()).attempts.length, 2);
  } finally { await w.close(); }
});

test('si Tomás tampoco responde queda sin cobertura y se avisa a Carla sin extender a Rodrigo (R05, R09)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    await w.service.reject(paula(w, at(NOW, 1_000)), s.handoff.id, respond(w, 'Paula', s, 'r1'));
    const s2 = await w.snapshot();
    const r = await w.service.reject(tomas(w, at(NOW, 2_000)), s2.handoff.id, respond(w, 'Tomás', s2, 'r2'));
    assert.ok(r.ok, JSON.stringify(r));
    const a = await w.snapshot();
    assert.equal(a.handoff.status, 'uncovered'); assert.equal(a.handoff.currentAttemptId, null);
    assert.equal(a.coverage.status, 'unconfirmed'); assert.equal(a.coverage.actorId, null);
    assert.equal(a.attempts.length, 2, 'no se crea un tercer intento hacia Rodrigo');
    assert.ok(a.events.some(e => e.kind === 'coverage_unconfirmed'));
    const carla = a.notifications.filter(n => n.recipientActorId === w.ids.Carla);
    assert.equal(carla.length, 1); assert.equal(carla[0].channel, 'in_app'); assert.equal(carla[0].subject.kind, 'coordination');
    assert.equal(r.value.handoff.status, 'uncovered'); assert.equal(r.value.coverage.status, 'unconfirmed');
    assert.ok(!a.notifications.some(n => n.recipientActorId === w.ids.Rodrigo));
  } finally { await w.close(); }
});

test('con un fixture donde la ventana lo declara respaldo, Rodrigo sí recibe el tercer intento (R08)', async () => {
  const w = await world(OUTGOING_ELIGIBLE_FIXTURE);
  try {
    const s = await sent(w);
    await w.service.reject(paula(w, at(NOW, 1_000)), s.handoff.id, respond(w, 'Paula', s, 'r1'));
    const a = await w.snapshot();
    assert.equal(a.attempts[1].candidateActorId, w.ids.Rodrigo);
  } finally { await w.close(); }
});

test('la acción tardía de Paula tras derivar no cambia la asignación (R06)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    await w.service.reject(paula(w, at(NOW, 1_000)), s.handoff.id, respond(w, 'Paula', s, 'r1'));
    const before = await w.snapshot();
    const late = await w.service.accept(paula(w, at(NOW, 3_000)), s.handoff.id, { ...respond(w, 'Paula', s, 'late'), attemptId: s.attempts[0].id });
    assert.deepEqual(late, { ok: false, code: 'CANDIDATE_STALE' });
    assert.deepEqual(await w.snapshot(), before);
  } finally { await w.close(); }
});

test('actuar con el plazo vencido sin que nadie evaluara devuelve ACTION_EXPIRED y no cambia nada', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const before = await w.snapshot();
    const r = await w.service.accept(paula(w, at(NOW, 30_000)), s.handoff.id, respond(w, 'Paula', s, 'late'));
    assert.deepEqual(r, { ok: false, code: 'ACTION_EXPIRED' });
    assert.deepEqual(await w.snapshot(), before);
  } finally { await w.close(); }
});

test('repetir la aceptación con la misma clave devuelve lo mismo; con otra clave, STATE_CONFLICT (R06)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const input = respond(w, 'Paula', s, 'a1');
    const first = await w.service.accept(paula(w, at(NOW, 5_000), BEFORE), s.handoff.id, input);
    const replay = await w.service.accept(paula(w, at(NOW, 6_000), BEFORE), s.handoff.id, input);
    assert.deepEqual(replay, first);
    const events = (await w.snapshot()).events.length;
    const other = await w.service.accept(paula(w, at(NOW, 7_000), BEFORE), s.handoff.id, { ...input, idempotencyKey: 'a2' });
    assert.ok(!other.ok);
    assert.equal((await w.snapshot()).events.length, events);
  } finally { await w.close(); }
});

test('solo el candidato vigente actúa; control debe representarlo y deja origen escenario', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const wrong = await w.service.accept(tomas(w, at(NOW, 1_000)), s.handoff.id, respond(w, 'Paula', s, 'x1'));
    assert.deepEqual(wrong, { ok: false, code: 'FORBIDDEN' });
    const viaControl = await w.service.accept(w.control(w.ids.Tomás, at(NOW, 1_000)), s.handoff.id, respond(w, 'Paula', s, 'x2'));
    assert.deepEqual(viaControl, { ok: false, code: 'FORBIDDEN' });
    const ok = await w.service.accept(w.control(w.ids.Paula, at(NOW, 2_000), BEFORE), s.handoff.id, respond(w, 'Paula', s, 'x3'));
    assert.ok(ok.ok);
    const last = (await w.snapshot()).events.at(-1)!;
    assert.deepEqual([last.origin, last.principal.kind, last.actorId], ['scenario', 'control', w.ids.Paula]);
    const stale = await w.service.accept(paula(w, at(NOW, 3_000)), s.handoff.id, { ...respond(w, 'Paula', s, 'x4'), expectedVersion: 99 });
    assert.ok(!stale.ok);
  } finally { await w.close(); }
});

test('versión vieja o intento desconocido no mutan', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const s = await sent(w);
    const before = await w.snapshot();
    assert.deepEqual(await w.service.accept(paula(w, at(NOW, 1_000)), s.handoff.id, { ...respond(w, 'Paula', s, 'v1'), expectedVersion: s.handoff.version + 5 }), { ok: false, code: 'VERSION_CONFLICT' });
    assert.deepEqual(await w.service.accept(paula(w, at(NOW, 1_000)), s.handoff.id, { ...respond(w, 'Paula', s, 'v2'), attemptId: 'handoff_attempt_inexistente' }), { ok: false, code: 'NOT_FOUND' });
    assert.deepEqual(await w.service.accept(paula(w, at(NOW, 1_000)), 'handoff_otro', respond(w, 'Paula', s, 'v3')), { ok: false, code: 'NOT_FOUND' });
    assert.deepEqual(await w.snapshot(), before);
  } finally { await w.close(); }
});
