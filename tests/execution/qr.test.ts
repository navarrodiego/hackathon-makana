import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { at, world } from './helpers';

const T = (ms: number) => at(BASE_FIXTURE.operationalAt, ms);

/** Abre el canal en t=0: espera y QR terminan a los 30 s. Devuelve un ayudante para pedir acciones de QR. */
async function opened() {
  const w = await world(BASE_FIXTURE);
  const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
  const channel = scenes.find(s => s.label === 'Canal')!;
  const before = await w.read.publicState(); assert.ok(before.ok);
  const open = await w.execution.changeScene(w.control(T(0)), { executionId: w.prepared.executionId, idempotencyKey: 'open', expectedVersion: before.value.version, sceneId: channel.id, channelOpen: true });
  assert.ok(open.ok, JSON.stringify(open));
  const qr = async (action: 'extend' | 'show', now: number, key: string, expectedVersion?: number) => {
    const state = await w.read.publicState(); assert.ok(state.ok);
    return w.execution.changeQr(w.control(T(now)), { executionId: w.prepared.executionId, idempotencyKey: key, expectedVersion: expectedVersion ?? state.value.version, action });
  };
  return { w, channel, qr, opened: open.value };
}

test('QR y espera ampliables desde control', async t => {
  await t.test('abrir el canal fija espera y QR a 30 s', async () => {
    const { w, opened: s } = await opened();
    try {
      assert.equal(s.lobbyEndsAt, T(30_000));
      assert.equal(s.qrEndsAt, T(30_000));
    } finally { await w.close(); }
  });

  await t.test('+30 s durante la espera alarga espera y QR, y registra un evento de escenario', async () => {
    const { w, qr } = await opened();
    try {
      const r = await qr('extend', 10_000, 'e1'); assert.ok(r.ok, JSON.stringify(r));
      assert.equal(r.value.lobbyEndsAt, T(60_000));
      assert.equal(r.value.qrEndsAt, T(60_000));
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      const ext = events.filter(e => e.kind === 'qr_extended');
      assert.equal(ext.length, 1);
      assert.equal(ext[0].origin, 'scenario');
    } finally { await w.close(); }
  });

  await t.test('mostrar el QR pasada la espera no vuelve a bloquear el envío; +30 s entonces solo alarga el QR', async () => {
    const { w, qr } = await opened();
    try {
      const shown = await qr('show', 45_000, 's1'); assert.ok(shown.ok, JSON.stringify(shown));
      assert.equal(shown.value.lobbyEndsAt, T(30_000));
      assert.equal(shown.value.qrEndsAt, T(75_000));
      const ext = await qr('extend', 50_000, 'e1'); assert.ok(ext.ok, JSON.stringify(ext));
      assert.equal(ext.value.lobbyEndsAt, T(30_000));
      assert.equal(ext.value.qrEndsAt, T(105_000));
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      assert.equal(events.filter(e => e.kind === 'qr_shown').length, 1);
    } finally { await w.close(); }
  });

  await t.test('el QR no puede quedar más de 120 s por delante', async () => {
    const { w, qr } = await opened();
    try {
      for (const [i, expected] of [[1, 60_000], [2, 90_000], [3, 120_000]] as const) {
        const r = await qr('extend', 0, `e${i}`); assert.ok(r.ok, JSON.stringify(r));
        assert.equal(r.value.qrEndsAt, T(expected));
      }
      assert.deepEqual(await qr('extend', 0, 'e4'), { ok: false, code: 'STATE_CONFLICT' });
    } finally { await w.close(); }
  });

  await t.test('extender sin QR visible o mostrar con QR visible es conflicto de estado', async () => {
    const { w, qr } = await opened();
    try {
      assert.deepEqual(await qr('show', 10_000, 's1'), { ok: false, code: 'STATE_CONFLICT' });
      assert.deepEqual(await qr('extend', 30_000, 'e1'), { ok: false, code: 'STATE_CONFLICT' });
    } finally { await w.close(); }
  });

  await t.test('canal cerrado, versión vieja y principal sin control se rechazan', async () => {
    const { w, qr, channel } = await opened();
    try {
      assert.deepEqual(await qr('extend', 10_000, 'v', 1), { ok: false, code: 'VERSION_CONFLICT' });
      const outgoing = w.ctx({ kind: 'outgoing', actorId: w.ids.Rodrigo }, w.ids.Rodrigo, T(10_000));
      const state = await w.read.publicState(); assert.ok(state.ok);
      assert.deepEqual(await w.execution.changeQr(outgoing, { executionId: w.prepared.executionId, idempotencyKey: 'f', expectedVersion: state.value.version, action: 'extend' }), { ok: false, code: 'FORBIDDEN' });
      const closed = await w.execution.changeScene(w.control(T(12_000)), { executionId: w.prepared.executionId, idempotencyKey: 'close', expectedVersion: state.value.version, sceneId: channel.id, channelOpen: false });
      assert.ok(closed.ok);
      assert.equal(closed.value.lobbyEndsAt, null);
      assert.equal(closed.value.qrEndsAt, null);
      assert.deepEqual(await qr('show', 15_000, 'c'), { ok: false, code: 'CHANNEL_CLOSED' });
    } finally { await w.close(); }
  });

  await t.test('repetir con la misma clave no duplica la ampliación', async () => {
    const { w, qr } = await opened();
    try {
      const state = await w.read.publicState(); assert.ok(state.ok);
      const first = await qr('extend', 10_000, 'dup', state.value.version);
      const second = await qr('extend', 10_000, 'dup', state.value.version);
      assert.ok(first.ok && second.ok);
      assert.equal(second.value.qrEndsAt, T(60_000));
      const events = await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }));
      assert.equal(events.filter(e => e.kind === 'qr_extended').length, 1);
    } finally { await w.close(); }
  });
});
