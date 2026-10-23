import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE, BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { createPersistedAuthorization } from '../../src/lib/server/auth/persistence';
import { handleCommand, handleState, type ExecutionHttpDeps } from '../../src/lib/server/execution/http';
import { createRequestValidator } from '../../src/lib/server/http/validate';
import { world } from './helpers';

const APP = 'http://127.0.0.1:3000';
const NOW = BASE_FIXTURE.operationalAt;
const basic = (u: string, s: string) => `Basic ${Buffer.from(`${u}:${s}`).toString('base64')}`;
const CONTROL = { authorization: basic('control', 'secreto-control') };
type W = Awaited<ReturnType<typeof world>>;

function harness(w: W) {
  const config = { outgoing: { username: 'rodrigo', secret: 'secreto-rodrigo' }, control: { username: 'control', secret: 'secreto-control' }, appOrigin: APP };
  const later: (() => Promise<unknown>)[] = [];
  const deps: ExecutionHttpDeps = {
    authorization: createPersistedAuthorization(w.store, config, () => NOW as Instant), service: w.execution,
    validator: createRequestValidator(), afterResponse: work => { later.push(work); },
  };
  const post = (route: 'POST /api/scene' | 'POST /api/reset', body: unknown, headers: Record<string, string> = {}, raw?: string) =>
    handleCommand(deps, route, new Request(`${APP}/api/x`, { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json', origin: APP, ...headers } }));
  return { deps, later, post };
}
const json = async (r: Response) => ({ status: r.status, body: await r.json(), headers: r.headers });

test('GET /api/state (S02/S03)', async t => {
  await t.test('devuelve estado saneado sin caché y su único efecto es evaluar vencimientos', async () => {
    const AWAITING = { ...BASE_FIXTURE, name: 'awaiting', handoffState: 'awaiting_candidate' } as const;
    const w = await world(AWAITING, { now: () => new Date(Date.parse(AWAITING.operationalAt) + 31_000).toISOString() as Instant });
    try {
      const res = await json(await handleState({ service: w.execution }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.body.ok, true);
      assert.equal(res.body.data.audience, 'public');
      assert.equal(res.body.data.handoff.candidate.displayName, 'Tomás', 'la consulta evaluó el plazo vencido de Paula');
      assert.doesNotMatch(JSON.stringify(res.body), /credentialHash|opaqueToken|topic|secret/i);
    } finally { await w.close(); }
  });

  await t.test('sin ejecución vigente responde 503, no un estado inventado', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      await w.db.$executeRaw`DELETE FROM executions`;
      const res = await json(await handleState({ service: w.execution }));
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'STORAGE_UNAVAILABLE');
    } finally { await w.close(); }
  });
});

test('POST /api/scene y /api/reset exigen control (S05)', async t => {
  await t.test('rechaza origen ajeno, JSON inválido, sin credencial y credencial de Rodrigo sin mutar', async () => {
    const w = await world(ACCEPTED_FIXTURE);
    try {
      const h = harness(w);
      const state = await w.read.publicState(); assert.ok(state.ok);
      const body = { executionId: w.prepared.executionId, idempotencyKey: 'k', expectedVersion: state.value.version };
      assert.equal((await json(await h.post('POST /api/reset', body, { ...CONTROL, origin: 'https://evil.example' }))).body.error.code, 'ORIGIN_REJECTED');
      assert.equal((await json(await h.post('POST /api/reset', body, CONTROL, '{no json'))).body.error.code, 'INVALID_INPUT');
      assert.equal((await json(await h.post('POST /api/reset', body, { ...CONTROL, 'content-type': 'text/plain' }))).body.error.code, 'INVALID_INPUT');
      assert.equal((await json(await h.post('POST /api/reset', body))).body.error.code, 'AUTH_REQUIRED');
      assert.equal((await json(await h.post('POST /api/reset', body, { authorization: basic('control', 'mal') }))).body.error.code, 'AUTH_INVALID');
      assert.equal((await json(await h.post('POST /api/reset', body, { authorization: basic('rodrigo', 'secreto-rodrigo') }))).body.error.code, 'FORBIDDEN');
      assert.equal((await json(await h.post('POST /api/reset', { ...body, extra: 1 }, CONTROL))).body.error.code, 'INVALID_INPUT');
      const after = await w.read.publicState(); assert.ok(after.ok);
      assert.equal(after.value.executionId, w.prepared.executionId, 'ningún rechazo reinició');
      assert.equal(h.later.length, 0);
    } finally { await w.close(); }
  });

  await t.test('reset de control responde 201, deja la preparación para después y la nota llega al ejecutarla', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const h = harness(w);
      const state = await w.read.publicState(); assert.ok(state.ok);
      const res = await json(await h.post('POST /api/reset', { executionId: w.prepared.executionId, idempotencyKey: 'r1', expectedVersion: state.value.version }, CONTROL));
      assert.equal(res.status, 201);
      assert.equal(res.body.data.preparation, 'pending');
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(h.later.length, 1);
      assert.equal(w.providerCalls.length, 0, 'la respuesta no esperó al proveedor');
      await h.later[0]();
      assert.equal(w.providerCalls.length, 1);
      const after = await w.read.publicState(); assert.ok(after.ok);
      assert.equal(after.value.preparation, 'ready');
      assert.equal(after.value.executionId, res.body.data.executionId);
    } finally { await w.close(); }
  });

  await t.test('reintentar el mismo reset por HTTP devuelve la misma sucesora; sin credencial o con otra carga no', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const h = harness(w);
      const state = await w.read.publicState(); assert.ok(state.ok);
      const body = { executionId: w.prepared.executionId, idempotencyKey: 'r-replay', expectedVersion: state.value.version };
      const first = await json(await h.post('POST /api/reset', body, CONTROL));
      const again = await json(await h.post('POST /api/reset', body, CONTROL));
      assert.equal(first.status, 201);
      assert.equal(again.status, 201);
      assert.equal(again.body.data.executionId, first.body.data.executionId);
      assert.equal(h.later.length, 2);
      await Promise.all(h.later.map(work => work()));
      assert.equal(w.providerCalls.length, 1, 'el reintento no paga una segunda generación de nota');
      assert.equal((await json(await h.post('POST /api/reset', body))).status, 401, 'sin credencial no hay replay');
      assert.equal((await json(await h.post('POST /api/reset', body, { authorization: basic('rodrigo', 'secreto-rodrigo') }))).status, 403);
      const other = await json(await h.post('POST /api/reset', { ...body, expectedVersion: body.expectedVersion + 1 }, CONTROL));
      assert.equal(other.body.error.code, 'IDEMPOTENCY_CONFLICT');
      const distinctKey = await json(await h.post('POST /api/reset', { ...body, idempotencyKey: 'r-otra' }, CONTROL));
      assert.equal(distinctKey.body.error.code, 'EXECUTION_STALE');
    } finally { await w.close(); }
  });

  await t.test('escena por HTTP con control: 200 y estado nuevo', async () => {
    const w = await world(BASE_FIXTURE);
    try {
      const h = harness(w);
      const state = await w.read.publicState(); assert.ok(state.ok);
      const scenes = await w.readTx(async tx => ({ ok: true, value: await tx.reference.scenes() }));
      const body = { executionId: w.prepared.executionId, idempotencyKey: 's1', expectedVersion: state.value.version, sceneId: scenes[1].id, channelOpen: true };
      const res = await json(await h.post('POST /api/scene', body, CONTROL));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.channelOpen, true);
      assert.equal(res.body.data.scene.label, 'Canal');
      const stale = await json(await h.post('POST /api/scene', { ...body, idempotencyKey: 's2' }, CONTROL));
      assert.equal(stale.status, 409);
      assert.equal(stale.body.error.code, 'VERSION_CONFLICT');
    } finally { await w.close(); }
  });
});
