import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE, INCIDENT_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, world } from './helpers';

const FORBIDDEN_KEYS = ['credentialHash', 'token', 'topic', 'opaqueToken', 'idempotencyKey', 'principalKey', 'details', 'savedSuggestion', 'note', 'text'];
// El texto recortado de los reportes de la sala es público (decisión de Diego del 24-10-2026); ningún otro `text`.
const allowed = (path: string, k: string) => k === 'text' && /^\.reports\[\d+\]$/.test(path);
const walk = (value: unknown, path = ''): string[] => {
  if (Array.isArray(value)) return value.flatMap((v, i) => walk(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => [...(FORBIDDEN_KEYS.includes(k) && !allowed(path, k) ? [`${path}.${k}`] : []), ...walk(v, `${path}.${k}`)]);
  return [];
};

test('estado público saneado (S02/S03)', async t => {
  await t.test('expone escena, relojes y cobertura sin campos privados', async () => {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const result = await w.read.publicState();
      assert.ok(result.ok);
      const state = result.value;
      assert.equal(state.audience, 'public');
      assert.equal(state.executionId, w.prepared.executionId);
      assert.equal(state.scene.label, 'Cierre');
      assert.equal(state.channelOpen, false);
      assert.equal(state.clocks.timeZone, 'America/Santiago');
      assert.equal(state.clocks.operationalNow, ACCEPTED_FIXTURE.operationalAt);
      assert.equal(state.clocks.narrativeNow, ACCEPTED_FIXTURE.narrativeAt);
      assert.equal(state.coverage?.status, 'scheduled');
      assert.equal(state.coverage?.actor?.displayName, 'Paula');
      assert.equal(state.handoff?.status, 'accepted');
      assert.equal(state.preparation, 'pending');
      assert.equal(state.closing, null, 'con el relevo enviado no hay resumen de cierre');
      assert.deepEqual(walk(state), []);
    } finally { await w.close(); }
  });

  await t.test('relevo en borrador: resumen del cierre solo con conteos, sin tickets ni nota', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const result = await w.read.publicState();
      assert.ok(result.ok);
      const closing = result.value.closing;
      assert.ok(closing);
      assert.equal(closing.outgoing.displayName, 'Rodrigo');
      assert.equal(closing.firstCandidate.displayName, 'Paula');
      assert.equal(closing.pendingCount, BASE_FIXTURE.tickets.length);
      assert.equal(closing.followUpCount, 1, 'solo #470 queda para seguimiento');
      assert.deepEqual(walk(result.value), []);
      const json = JSON.stringify(result.value);
      for (const ticket of BASE_FIXTURE.tickets) {
        assert.ok(!json.includes(ticket.reference), `sin la referencia ${ticket.reference}`);
        assert.ok(!json.includes(ticket.text), `sin el texto de ${ticket.reference}`);
      }
    } finally { await w.close(); }
  });

  await t.test('lee el estado sin cambiarlo: dos lecturas iguales', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const a = await w.read.publicState(), b = await w.read.publicState();
      assert.deepEqual(a, b);
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      assert.equal(events.length, 0);
    } finally { await w.close(); }
  });

  await t.test('incidente en curso: candidato, plazo propio y conteo de avisos al saliente', async () => {
    const w = await world(INCIDENT_FIXTURE);
    try {
      const result = await w.read.publicState();
      assert.ok(result.ok);
      assert.equal(result.value.incidents.length, 1);
      const incident = result.value.incidents[0];
      assert.equal(incident.status, 'awaiting_ack');
      assert.equal(incident.candidate?.displayName, 'Paula');
      assert.ok(incident.deadlineAt);
      assert.equal(result.value.outgoingNoticeCount, 0);
      assert.deepEqual(result.value.reports.map(r => [r.nickname, r.status, r.duplicate]), [['Reporte de prueba', 'incident', false]]);
      assert.deepEqual(Object.keys(result.value.reports[0]).sort(), ['duplicate', 'id', 'narrativeAt', 'nickname', 'status', 'text']);
      assert.deepEqual(walk(result.value), []);
    } finally { await w.close(); }
  });

  await t.test('sin ejecución vigente responde error de almacenamiento y no inventa estado', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      await w.db.$executeRaw`DELETE FROM executions`;
      const result = await w.read.publicState();
      assert.deepEqual(result, { ok: false, code: 'STORAGE_UNAVAILABLE' });
    } finally { await w.close(); }
  });

  void at;
});
