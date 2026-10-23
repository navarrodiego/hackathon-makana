import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE, INCIDENT_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { ExecutionFixture } from '../../src/lib/contracts/fixtures';
import type { NotificationService } from '../../src/lib/contracts/services';
import { at, world } from './helpers';

// Relevo enviado: plazo de 30 s propio del candidato, cobertura sin confirmar.
const AWAITING = { ...BASE_FIXTURE, name: 'awaiting', handoffState: 'awaiting_candidate' } as const satisfies ExecutionFixture;

test('evaluación de plazos al consultar el estado (I06/I07)', async t => {
  await t.test('plazos de relevo e incidente son independientes y la escena no los acelera (I06)', async () => {
    // Relevo vence a +10 s; incidente a +30 s. Una escena avanza la hora narrativa pero no el reloj real.
    const w = await world(INCIDENT_FIXTURE);
    try {
      const base = INCIDENT_FIXTURE.operationalAt;
      const state = await w.execution.evaluate(w.system(base));
      assert.ok(state.ok);
      assert.equal(state.value.incidents[0].status, 'awaiting_ack');

      const scene = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const night = scene.find(s => s.label === 'Registro de noche')!;
      const exec0 = state.value;
      const changed = await w.execution.changeScene(w.control(base), {
        executionId: w.prepared.executionId, idempotencyKey: 'scene-night', expectedVersion: exec0.version, sceneId: night.id, channelOpen: true,
      });
      assert.ok(changed.ok, JSON.stringify(changed));
      // Seis horas narrativas después, siguen a 0 s reales: el incidente conserva su candidato y plazo.
      assert.equal(changed.value.incidents[0].status, 'awaiting_ack');
      assert.equal(changed.value.incidents[0].candidate?.displayName, 'Paula');
      assert.equal(changed.value.incidents[0].deadlineAt, state.value.incidents[0].deadlineAt);

      // A +31 s reales vence el incidente y deriva a Tomás, con 30 s propios desde ese instante.
      w.setNow(at(base, 31_000));
      const later = await w.execution.evaluate(w.system());
      assert.ok(later.ok);
      assert.equal(later.value.incidents[0].candidate?.displayName, 'Tomás');
      assert.equal(later.value.incidents[0].deadlineAt, at(base, 61_000));
    } finally { await w.close(); }
  });

  await t.test('lecturas concurrentes no duplican derivaciones ni avisos (I07)', async () => {
    const w = await world(AWAITING);
    try {
      const sent = AWAITING.operationalAt;
      w.setNow(at(sent, 31_000));
      const results = await Promise.all(Array.from({ length: 8 }, () => w.execution.evaluate(w.system())));
      assert.ok(results.every(r => r.ok));
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      assert.equal(events.filter(e => e.kind === 'handoff_expired').length, 1);
      assert.equal(events.filter(e => e.kind === 'handoff_derived').length, 1);
      const attempts = await w.readTx(async tx => ({ ok: true, value: await tx.aggregates.handoffAttempts.list() }));
      assert.equal(attempts.length, 2);
      assert.equal(attempts.filter(a => a.status === 'pending').length, 1);
    } finally { await w.close(); }
  });

  await t.test('sin lectores nada avanza; al volver una consulta evalúa lo vencido una sola vez (I07)', async () => {
    const w = await world(AWAITING);
    try {
      const sent = AWAITING.operationalAt;
      // Nadie consulta durante 3 minutos: el estado guardado sigue con Paula, sin transiciones.
      w.setNow(at(sent, 180_000));
      const frozen = await w.read.publicState();
      assert.ok(frozen.ok);
      assert.equal(frozen.value.handoff?.candidate?.displayName, 'Paula');
      // Al reanudar: Paula vence, Tomás recibe su plazo propio desde ahora y no desde hace 3 minutos.
      const resumed = await w.execution.evaluate(w.system());
      assert.ok(resumed.ok);
      assert.equal(resumed.value.handoff?.candidate?.displayName, 'Tomás');
      assert.equal(resumed.value.handoff?.deadlineAt, at(sent, 210_000));
      const again = await w.execution.evaluate(w.system());
      assert.ok(again.ok);
      assert.equal(again.value.handoff?.candidate?.displayName, 'Tomás');
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      assert.equal(events.filter(e => e.kind === 'handoff_expired').length, 1);
    } finally { await w.close(); }
  });

  await t.test('despacha avisos pendientes con el contexto de la ejecución vigente', async () => {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      await w.execution.evaluate(w.system());
      assert.deepEqual(w.notified, [w.prepared.executionId]);
    } finally { await w.close(); }
  });

  await t.test('un fallo del transporte no impide entregar el estado ni se oculta como éxito', async () => {
    const failing: NotificationService = { dispatchPending: async () => { throw new Error('ntfy caído'); } };
    const w = await world(INCIDENT_FIXTURE, { notifications: failing });
    try {
      const state = await w.execution.evaluate(w.system());
      assert.ok(state.ok);
      assert.ok(state.value.notifications.every(n => n.status !== 'provider_accepted'));
    } finally { await w.close(); }
  });

  await t.test('evaluar una ejecución retirada no toca la vigente', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const stale = await w.execution.evaluate(w.system());
      assert.ok(stale.ok);
      const old = w.ctx({ kind: 'system' }, null, BASE_FIXTURE.operationalAt, BASE_FIXTURE.narrativeAt, 'execution_vieja');
      assert.deepEqual(await w.execution.evaluate(old), { ok: false, code: 'EXECUTION_STALE' });
    } finally { await w.close(); }
  });
});
