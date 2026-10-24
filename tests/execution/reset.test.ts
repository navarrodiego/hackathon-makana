import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE, INCIDENT_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { ProviderResult, NoteOutput } from '../../src/lib/contracts/classification';
import { echoNote, world } from './helpers';

const resetInput = (executionId: string, version: number, key: string) => ({ executionId: executionId as never, idempotencyKey: key, expectedVersion: version });
const versionOf = async (w: Awaited<ReturnType<typeof world>>) => { const s = await w.read.publicState(); assert.ok(s.ok); return s.value.version; };

test('reset escénico (S04)', async t => {
  await t.test('crea una ejecución nueva con canal cerrado, pendientes del escenario y preparación pendiente', async () => {
    const w = await world(INCIDENT_FIXTURE);
    try {
      const result = await w.execution.reset(w.control(), resetInput(w.prepared.executionId, await versionOf(w), 'reset-1'));
      assert.ok(result.ok, JSON.stringify(result));
      assert.equal(result.value.previousExecutionId, w.prepared.executionId);
      assert.notEqual(result.value.executionId, w.prepared.executionId);
      assert.equal(result.value.preparation, 'pending');
      const state = result.value.state;
      assert.equal(state.executionId, result.value.executionId);
      assert.equal(state.channelOpen, false);
      assert.equal(state.scene.label, 'Cierre');
      assert.equal(state.incidents.length, 0);
      assert.equal(state.handoff?.status, 'draft');
      assert.equal(state.coverage?.status, 'unconfirmed');
      assert.deepEqual(state.events.map(e => e.kind), ['execution_started']);
      const tickets = await w.readTx(async tx => ({ ok: true, value: await tx.aggregates.tickets.list() }), result.value.executionId);
      assert.deepEqual(tickets.map(x => x.reference).sort(), ['#462', '#470', '#481']);
      // Cada pendiente trae la decisión y la razón del escenario, no un texto de relleno.
      for (const f of BASE_FIXTURE.tickets) {
        const seeded = tickets.find(x => x.reference === f.reference);
        assert.equal(seeded?.disposition, f.disposition);
        assert.equal(seeded?.reason, f.reason);
      }
      const current = await w.read.publicState();
      assert.ok(current.ok);
      assert.equal(current.value.executionId, result.value.executionId);
    } finally { await w.close(); }
  });

  await t.test('la ejecución retirada rechaza escenas, relevos y evaluación', async () => {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const old = w.prepared.executionId;
      const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const version = await versionOf(w);
      assert.ok((await w.execution.reset(w.control(), resetInput(old, version, 'reset-2'))).ok);
      const scene = await w.execution.changeScene(w.control(), { executionId: old, idempotencyKey: 'late', expectedVersion: version, sceneId: scenes[1].id, channelOpen: true });
      assert.deepEqual(scene, { ok: false, code: 'EXECUTION_STALE' });
      assert.deepEqual(await w.execution.evaluate(w.system()), { ok: false, code: 'EXECUTION_STALE' });
      const accept = await w.handoff.accept(
        w.ctx({ kind: 'recipient', actorId: w.ids.Paula, grant: {} as never }, w.ids.Paula, ACCEPTED_FIXTURE.operationalAt, undefined, old, 'ntfy_action'),
        w.prepared.handoff.id, { executionId: old, idempotencyKey: 'tarde', expectedVersion: 1, attemptId: 'handoff_attempt_x' as never },
      );
      assert.deepEqual(accept, { ok: false, code: 'EXECUTION_STALE' });
    } finally { await w.close(); }
  });

  await t.test('reintento con la misma clave devuelve la misma sucesora; otra versión o carga no crea otra', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const old = w.prepared.executionId, version = await versionOf(w);
      const first = await w.execution.reset(w.control(), resetInput(old, version, 'reset-3'));
      const second = await w.execution.reset(w.control(), resetInput(old, version, 'reset-3'));
      assert.ok(first.ok && second.ok);
      assert.equal(second.value.executionId, first.value.executionId);
      const conflict = await w.execution.reset(w.control(), resetInput(old, version + 1, 'reset-3'));
      assert.deepEqual(conflict, { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
      const other = await w.execution.reset(w.control(), resetInput(old, version, 'reset-otra'));
      assert.deepEqual(other, { ok: false, code: 'EXECUTION_STALE' });
      const count = await w.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM executions WHERE status='active'`;
      assert.equal(count[0].n, 1);
    } finally { await w.close(); }
  });

  await t.test('resets simultáneos con la misma clave crean una sola ejecución', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const old = w.prepared.executionId, version = await versionOf(w);
      const results = await Promise.all(Array.from({ length: 5 }, () => w.execution.reset(w.control(), resetInput(old, version, 'reset-par'))));
      assert.ok(results.every(r => r.ok), JSON.stringify(results));
      const ids = new Set(results.map(r => r.ok ? r.value.executionId : ''));
      assert.equal(ids.size, 1);
      const total = await w.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM executions`;
      assert.equal(total[0].n, 2);
    } finally { await w.close(); }
  });

  await t.test('resets encadenados con claves distintas: cada uno parte de la vigente', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const first = await w.execution.reset(w.control(), resetInput(w.prepared.executionId, await versionOf(w), 'a'));
      assert.ok(first.ok);
      const second = await w.execution.reset(w.control(undefined, first.value.executionId), resetInput(first.value.executionId, first.value.state.version, 'b'));
      assert.ok(second.ok, JSON.stringify(second));
      assert.notEqual(second.value.executionId, first.value.executionId);
      const active = await w.db.$queryRaw<{ executionId: string }[]>`SELECT "executionId" FROM executions WHERE status='active'`;
      assert.deepEqual(active.map(a => a.executionId), [second.value.executionId]);
    } finally { await w.close(); }
  });

  await t.test('solo control reinicia', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const input = resetInput(w.prepared.executionId, await versionOf(w), 'x');
      assert.deepEqual(await w.execution.reset(w.system(), input), { ok: false, code: 'FORBIDDEN' });
      const outgoing = w.ctx({ kind: 'outgoing', actorId: w.ids.Rodrigo }, w.ids.Rodrigo, BASE_FIXTURE.operationalAt);
      assert.deepEqual(await w.execution.reset(outgoing, input), { ok: false, code: 'FORBIDDEN' });
    } finally { await w.close(); }
  });
});

test('preparación de la nota tras el reset (C03/C09)', async t => {
  await t.test('sin servicio de nota marca la preparación lista sin llamar al proveedor', async () => {
    const w = await world(BASE_FIXTURE, { withoutNote: true });
    try {
      const reset = await w.execution.reset(w.control(), resetInput(w.prepared.executionId, await versionOf(w), 'p-0'));
      assert.ok(reset.ok);
      assert.deepEqual(await w.execution.prepareNote(w.control(undefined, reset.value.executionId)), { ok: true, value: 'ready' });
      assert.equal(w.providerCalls.length, 0);
      const state = await w.read.publicState();
      assert.ok(state.ok);
      assert.equal(state.value.preparation, 'ready');
      assert.equal(await w.readTx(async tx => ({ ok: true, value: await tx.notes.get() }), reset.value.executionId), null);
    } finally { await w.close(); }
  });

  await t.test('genera y guarda la nota de la ejecución nueva y la marca lista', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const reset = await w.execution.reset(w.control(), resetInput(w.prepared.executionId, await versionOf(w), 'p-1'));
      assert.ok(reset.ok);
      assert.equal(w.providerCalls.length, 0, 'el reset no llama al proveedor dentro de su transacción');
      const prepared = await w.execution.prepareNote(w.control(undefined, reset.value.executionId));
      assert.deepEqual(prepared, { ok: true, value: 'ready' });
      assert.equal(w.providerCalls.length, 1);
      const state = await w.read.publicState();
      assert.ok(state.ok);
      assert.equal(state.value.preparation, 'ready');
      const saved = await w.readTx(async tx => ({ ok: true, value: await tx.notes.get() }), reset.value.executionId);
      assert.ok(saved?.output.note.length);
      // Una segunda llamada no vuelve a escribir una preparación que ya terminó.
      assert.deepEqual(await w.execution.prepareNote(w.control(undefined, reset.value.executionId)), { ok: true, value: 'ready' });
    } finally { await w.close(); }
  });

  await t.test('si el proveedor falla queda failed, sin nota inventada', async () => {
    const failing = (): ProviderResult<NoteOutput> => ({ ok: false, reason: 'unavailable' } as never);
    const w = await world(BASE_FIXTURE, { provider: failing });
    try {
      const reset = await w.execution.reset(w.control(), resetInput(w.prepared.executionId, await versionOf(w), 'p-2'));
      assert.ok(reset.ok);
      assert.deepEqual(await w.execution.prepareNote(w.control(undefined, reset.value.executionId)), { ok: true, value: 'failed' });
      const state = await w.read.publicState();
      assert.ok(state.ok);
      assert.equal(state.value.preparation, 'failed');
      const saved = await w.readTx(async tx => ({ ok: true, value: await tx.notes.get() }), reset.value.executionId);
      assert.equal(saved, null);
    } finally { await w.close(); }
  });

  await t.test('un reset durante la generación descarta la respuesta tardía y no repuebla la nueva (S04)', async () => {
    const ref: { w?: Awaited<ReturnType<typeof world>> } = {};
    let second: string | null = null;
    const w = await world(BASE_FIXTURE, {
      provider: async req => {
        // Mientras la IA "piensa", el control reinicia otra vez.
        const self = ref.w!;
        const current = await self.read.publicState();
        assert.ok(current.ok);
        const again = await self.execution.reset(self.control(undefined, req.fence.executionId), resetInput(req.fence.executionId, current.value.version, 'p-3b'));
        assert.ok(again.ok);
        second = again.value.executionId;
        return echoNote(req);
      },
    });
    ref.w = w;
    try {
      const first = await w.execution.reset(w.control(), resetInput(w.prepared.executionId, await versionOf(w), 'p-3a'));
      assert.ok(first.ok);
      const prepared = await w.execution.prepareNote(w.control(undefined, first.value.executionId));
      assert.equal(prepared.ok, false);
      assert.ok(second);
      const state = await w.read.publicState();
      assert.ok(state.ok);
      assert.equal(state.value.executionId, second);
      assert.equal(state.value.preparation, 'pending');
      const saved = await w.readTx(async tx => ({ ok: true, value: await tx.notes.get() }), second!);
      assert.equal(saved, null);
    } finally { await w.close(); }
  });
});
