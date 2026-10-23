import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { LIMITS } from '../../src/lib/contracts/core';
import { at, factsKey, world } from './helpers';

const NOW = ACCEPTED_FIXTURE.operationalAt;
const NARRATIVE = '2026-10-24T01:10:01.000Z' as const; // dentro de la ventana de Paula

test('crítico con cobertura efectiva: un incidente y un aviso al titular, no a un nombre fijo (I02)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const r = await w.ingest(factsKey('no emite boletas'), NOW, NARRATIVE);
    assert.ok(r.ok && r.value.incident && !r.value.duplicate);
    const s = await w.snapshot();
    assert.equal(s.incidents.length, 1);
    assert.equal(s.incidents[0].status, 'awaiting_ack');
    assert.equal(s.attempts.length, 1);
    assert.equal(s.attempts[0].candidateActorId, w.ids.Paula);
    assert.equal(s.attempts[0].deadlineAt, at(NOW, LIMITS.candidateDeadlineMs));
    assert.equal(s.incidents[0].currentAttemptId, s.attempts[0].id);
    const intents = s.notifications.filter(n => n.subject.kind === 'incident');
    assert.equal(intents.length, 1);
    assert.equal(intents[0].recipientActorId, w.ids.Paula);
    assert.equal(intents[0].channel, 'ntfy');
    assert.ok(s.events.some(e => e.kind === 'incident_created'));
    assert.equal(s.reports[0].incidentId, s.incidents[0].id);
  } finally { await w.close(); }
});

test('el titular de la cobertura efectiva manda aunque el nombre cambie (R08)', async () => {
  const w = await world({ ...ACCEPTED_FIXTURE, acceptedBy: 'actor_backup' });
  try {
    const r = await w.ingest(factsKey('no emite boletas'), NOW, NARRATIVE);
    assert.ok(r.ok && r.value.incident);
    const s = await w.snapshot();
    assert.equal(s.attempts[0].candidateActorId, w.ids.Tomás);
    assert.equal(s.notifications.find(n => n.subject.kind === 'incident')!.channel, 'in_app');
  } finally { await w.close(); }
});

test('sin cobertura efectiva: coordinación, sin técnico inventado (R09)', async () => {
  const w = await world(BASE_FIXTURE); // relevo en borrador: nadie aceptó
  try {
    const r = await w.ingest(factsKey('no emite boletas'), NOW, NARRATIVE);
    assert.ok(r.ok && r.value.incident);
    const s = await w.snapshot();
    assert.equal(s.incidents[0].status, 'unacknowledged');
    assert.equal(s.attempts.length, 0);
    assert.equal(s.incidents[0].currentAttemptId, null);
    const intents = s.notifications.filter(n => n.subject.kind === 'coordination');
    assert.equal(intents.length, 1);
    assert.equal(intents[0].recipientActorId, w.ids.Carla);
    assert.ok(s.events.some(e => e.kind === 'incident_unacknowledged'));
  } finally { await w.close(); }
});

test('ruta cola no crea incidente ni aviso; ruta revisión sí (misma máquina de acuse)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const q = await w.ingest(factsKey('impresora sin tóner'), NOW, NARRATIVE, { route: 'queue', reason: 'Puede esperar.', nextAttentionAt: null });
    assert.ok(q.ok && q.value.incident === null && !q.value.duplicate);
    assert.equal((await w.snapshot()).incidents.length, 0);
    const v = await w.ingest(factsKey('red lenta'), NOW, NARRATIVE, { route: 'review', reason: 'Revisión de la guardia.' });
    assert.ok(v.ok && v.value.incident);
    const s = await w.snapshot();
    assert.equal(s.incidents.length, 1);
    assert.equal(s.attempts[0].candidateActorId, w.ids.Paula);
  } finally { await w.close(); }
});
