import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { at, world } from './helpers';

const NOW = ACCEPTED_FIXTURE.operationalAt;
const sys = (w: Awaited<ReturnType<typeof world>>, narrative: Instant) => w.ctx({ kind: 'system' }, null, at(NOW, 1_000), narrative, 'system');

test('cobertura programada se activa en la ventana y el fin del saliente se registra una sola vez, independientes', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    assert.equal((await w.snapshot()).coverage.status, 'scheduled');
    assert.deepEqual(await w.service.evaluateDeadlines(sys(w, '2026-10-24T01:09:59.999Z')), { ok: true, value: [] });
    const r = await w.service.evaluateDeadlines(sys(w, '2026-10-24T01:10:00.000Z'));
    assert.ok(r.ok && r.value.length === 1);
    const a = await w.snapshot();
    assert.equal(a.coverage.status, 'active');
    assert.deepEqual(a.events.filter(e => ['coverage_activated', 'outgoing_ended'].includes(e.kind)).map(e => e.kind).sort(), ['coverage_activated', 'outgoing_ended']);
    assert.deepEqual(await w.service.evaluateDeadlines(sys(w, '2026-10-24T02:00:00.000Z')), { ok: true, value: [] });
    assert.equal((await w.snapshot()).events.length, a.events.length, 'repetir no duplica eventos');
  } finally { await w.close(); }
});

test('el saliente termina aunque no haya cobertura: no se prolonga ni se activa nada', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    await w.service.evaluateDeadlines(sys(w, '2026-10-24T01:10:00.000Z'));
    const a = await w.snapshot();
    assert.equal(a.coverage.status, 'unconfirmed');
    assert.deepEqual(a.events.map(e => e.kind), ['outgoing_ended']);
  } finally { await w.close(); }
});

test('cobertura efectiva solo existe aceptada y dentro de [inicio, fin) por la hora narrativa', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const eff = (narrative: Instant) => w.read(tx => w.service.effectiveCoverage(sys(w, narrative), tx));
    assert.equal(await eff('2026-10-24T01:09:59.999Z'), null);
    const inside = await eff('2026-10-24T01:10:00.000Z');
    assert.ok(inside?.status === 'active' && inside.actor.id === w.ids.Paula);
    assert.equal(await eff('2026-10-24T11:00:00.000Z'), null);
  } finally { await w.close(); }
});

test('sin aceptación no hay cobertura efectiva y el respaldo excluye lo ya intentado', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const c = sys(w, '2026-10-24T02:00:00.000Z');
    assert.equal(await w.read(tx => w.service.effectiveCoverage(c, tx)), null);
    assert.deepEqual(await w.read(tx => w.service.eligibleBackup(c, [w.ids.Paula], tx)), w.ids.Tomás);
    assert.deepEqual(await w.read(tx => w.service.eligibleBackup(c, [w.ids.Paula, w.ids.Tomás], tx)), null);
    assert.deepEqual(await w.read(tx => w.service.eligibleBackup(c, [], tx)), w.ids.Paula);
  } finally { await w.close(); }
});
