import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, factsKey, world } from './helpers';

const NOW = ACCEPTED_FIXTURE.operationalAt;
const N0 = '2026-10-24T01:10:01.000Z' as const;

test('reportes equivalentes simultáneos: un incidente, un aviso lógico, todos los reportes vinculados (I04)', async () => {
  for (let round = 0; round < 3; round++) {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const key = factsKey('no emite boletas');
      const results = await Promise.all([1, 2, 3].map(i => w.ingest(key, at(NOW, i), at(N0, i * 100))));
      assert.ok(results.every(r => r.ok));
      const s = await w.snapshot();
      assert.equal(s.incidents.length, 1, `ronda ${round}`);
      assert.equal(s.attempts.length, 1);
      assert.equal(s.notifications.filter(n => n.subject.kind === 'incident').length, 1);
      assert.equal(s.reports.filter(r => r.incidentId === s.incidents[0].id).length, 3);
      assert.equal(results.filter(r => r.ok && r.value.duplicate).length, 2);
      assert.equal(s.events.filter(e => e.kind === 'incident_created').length, 1);
      assert.equal(s.events.filter(e => e.kind === 'report_linked').length, 2);
    } finally { await w.close(); }
  }
});

test('hechos distintos del mismo servicio se conservan separados (I04)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    await w.ingest(factsKey('no emite boletas', 'local 7'), NOW, N0);
    await w.ingest(factsKey('no emite boletas', 'local 9'), at(NOW, 1), at(N0, 1));
    const s = await w.snapshot();
    assert.equal(s.incidents.length, 2);
    assert.equal(s.notifications.filter(n => n.subject.kind === 'incident').length, 2);
  } finally { await w.close(); }
});

test('borde de 10 min narrativos, sin tocar el plazo real (I05)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const key = factsKey('no emite boletas');
    await w.ingest(key, NOW, N0);
    const inside = await w.ingest(key, at(NOW, 1), at(N0, 599_999));
    assert.ok(inside.ok && inside.value.duplicate);
    const edge = await w.ingest(key, at(NOW, 2), at(N0, 600_000));
    assert.ok(edge.ok && edge.value.incident && !edge.value.duplicate);
    const after = await w.ingest(key, at(NOW, 3), at(N0, 600_001));
    // 600_001 está a 1 ms de la ventana del segundo incidente (anclada a su propio primer reporte).
    assert.ok(after.ok && after.value.duplicate);
    const s = await w.snapshot();
    assert.equal(s.incidents.length, 2);
    // Los plazos son operacionales: el segundo incidente venció según su propio reloj, no el narrativo.
    assert.equal(s.attempts[1].deadlineAt, at(at(NOW, 2), 30_000));
  } finally { await w.close(); }
});
