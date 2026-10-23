import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, world } from './helpers';

test('cambio de escena (S05)', async t => {
  await t.test('cambia escena, canal y hora narrativa; registra un evento de escenario sin resultados falsos', async () => {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const channel = scenes.find(s => s.label === 'Canal')!;
      const before = await w.read.publicState(); assert.ok(before.ok);
      const input = { executionId: w.prepared.executionId, idempotencyKey: 'scene-1', expectedVersion: before.value.version, sceneId: channel.id, channelOpen: true };
      const result = await w.execution.changeScene(w.control(), input);
      assert.ok(result.ok, JSON.stringify(result));
      assert.equal(result.value.scene.label, 'Canal');
      assert.equal(result.value.channelOpen, true);
      // 01:10 narrativo: arranca la cobertura que Paula aceptó antes y termina el turno de Rodrigo.
      assert.equal(result.value.coverage?.status, 'active');
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      const scene = events.filter(e => e.kind === 'scene_changed');
      assert.equal(scene.length, 1);
      assert.equal(scene[0].origin, 'scenario');
      assert.equal(scene[0].principal.kind, 'control');
      assert.equal(events.some(e => e.kind === 'incident_created' || e.kind === 'incident_taken' || e.kind === 'handoff_accepted'), false);
    } finally { await w.close(); }
  });

  await t.test('reintento con la misma clave devuelve el mismo estado y no repite el evento; otra carga con esa clave conflicta', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const night = scenes.find(s => s.label === 'Registro de noche')!, morning = scenes.find(s => s.label === 'Registro de mañana')!;
      const before = await w.read.publicState(); assert.ok(before.ok);
      const input = { executionId: w.prepared.executionId, idempotencyKey: 'scene-dup', expectedVersion: before.value.version, sceneId: night.id, channelOpen: true };
      const first = await w.execution.changeScene(w.control(), input);
      const second = await w.execution.changeScene(w.control(), input);
      assert.ok(first.ok && second.ok);
      assert.equal(second.value.scene.id, night.id);
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      assert.equal(events.filter(e => e.kind === 'scene_changed').length, 1);
      const different = await w.execution.changeScene(w.control(), { ...input, sceneId: morning.id });
      assert.deepEqual(different, { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    } finally { await w.close(); }
  });

  await t.test('versión vieja, escena desconocida y ejecución retirada se rechazan sin cambios', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const before = await w.read.publicState(); assert.ok(before.ok);
      const base = { executionId: w.prepared.executionId, expectedVersion: before.value.version, sceneId: scenes[1].id, channelOpen: false };
      assert.deepEqual(await w.execution.changeScene(w.control(), { ...base, idempotencyKey: 'v', expectedVersion: before.value.version + 5 }), { ok: false, code: 'VERSION_CONFLICT' });
      assert.deepEqual(await w.execution.changeScene(w.control(), { ...base, idempotencyKey: 'u', sceneId: 'scene_inexistente' }), { ok: false, code: 'NOT_FOUND' });
      const stale = w.control(at(BASE_FIXTURE.operationalAt, 0), 'execution_vieja');
      assert.deepEqual(await w.execution.changeScene(stale, { ...base, executionId: 'execution_vieja', idempotencyKey: 's' }), { ok: false, code: 'EXECUTION_STALE' });
      const after = await w.read.publicState(); assert.ok(after.ok);
      assert.equal(after.value.version, before.value.version);
      assert.equal(after.value.scene.label, 'Cierre');
    } finally { await w.close(); }
  });

  await t.test('solo control puede cambiar la escena', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const before = await w.read.publicState(); assert.ok(before.ok);
      const input = { executionId: w.prepared.executionId, idempotencyKey: 'x', expectedVersion: before.value.version, sceneId: scenes[1].id, channelOpen: true };
      const outgoing = w.ctx({ kind: 'outgoing', actorId: w.ids.Rodrigo }, w.ids.Rodrigo, BASE_FIXTURE.operationalAt);
      assert.deepEqual(await w.execution.changeScene(outgoing, input), { ok: false, code: 'FORBIDDEN' });
      assert.deepEqual(await w.execution.changeScene(w.system(), input), { ok: false, code: 'FORBIDDEN' });
    } finally { await w.close(); }
  });
});
