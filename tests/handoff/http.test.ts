import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { createPersistedAuthorization } from '../../src/lib/server/auth/persistence';
import { createRequestValidator } from '../../src/lib/server/http/validate';
import { handleHandoffRequest } from '../../src/lib/server/handoff/http';
import { at, world } from './helpers';

const APP = 'http://127.0.0.1:3000';
const NOW = BASE_FIXTURE.operationalAt;
const BEFORE: Instant = '2026-10-24T01:09:50.000Z';
const basic = (u: string, s: string) => `Basic ${Buffer.from(`${u}:${s}`).toString('base64')}`;
type W = Awaited<ReturnType<typeof world>>;

function harness(w: W) {
  const clock = { now: NOW as Instant };
  const config = { outgoing: { username: 'rodrigo', secret: 'secreto-rodrigo' }, control: { username: 'control', secret: 'secreto-control' }, appOrigin: APP };
  const authorization = createPersistedAuthorization(w.store, config, () => clock.now);
  const deps = { store: w.store, authorization, service: w.service, validator: createRequestValidator(), now: () => clock.now };
  const post = (route: Parameters<typeof handleHandoffRequest>[1], body: unknown, headers: Record<string, string> = {}, params: unknown = null, raw?: string) =>
    handleHandoffRequest(deps, route, new Request(`${APP}/api/x`, { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json', origin: APP, ...headers } }), params);
  return { clock, authorization, post };
}
async function sendBody(w: W, key = 'send') {
  const s = await w.snapshot();
  return { executionId: w.prepared.executionId, idempotencyKey: key, expectedVersion: s.handoff.version, handoffId: s.handoff.id, note: 'Nota.',
    tickets: s.tickets.map(t => ({ ticketId: t.id, disposition: t.disposition, reason: 'Revisado.' })) };
}
const json = async (r: Response) => ({ status: r.status, body: await r.json(), headers: r.headers });

test('enviar por HTTP exige origen, JSON válido y credencial del saliente; responde sin caché', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const h = harness(w); const body = await sendBody(w);
    const rodrigo = { authorization: basic('rodrigo', 'secreto-rodrigo') };
    const noOrigin = await json(await h.post('POST /api/handoff', body, { ...rodrigo, origin: 'https://evil.example' }));
    assert.equal(noOrigin.status, 403); assert.equal(noOrigin.body.error.code, 'ORIGIN_REJECTED');
    assert.equal((await json(await h.post('POST /api/handoff', body, rodrigo, null, '{no json'))).body.error.code, 'INVALID_INPUT');
    assert.equal((await json(await h.post('POST /api/handoff', body, { ...rodrigo, 'content-type': 'text/plain' }))).body.error.code, 'INVALID_INPUT');
    assert.equal((await json(await h.post('POST /api/handoff', body, {}))).body.error.code, 'AUTH_REQUIRED');
    assert.equal((await json(await h.post('POST /api/handoff', body, { authorization: basic('rodrigo', 'mal') }))).body.error.code, 'AUTH_INVALID');
    assert.equal((await w.snapshot()).handoff.status, 'draft', 'ningún rechazo mutó');
    const ok = await json(await h.post('POST /api/handoff', body, rodrigo));
    assert.equal(ok.status, 201); assert.equal(ok.body.ok, true); assert.equal(ok.body.data.handoff.status, 'awaiting_candidate');
    assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.match(ok.body.correlationId, /^correlation_/);
    assert.doesNotMatch(JSON.stringify(ok.body), /secreto|token|bearer/i);
  } finally { await w.close(); }
});

test('Paula acepta con su enlace limitado; el token de otro intento o sin origen no sirve (R06)', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const h = harness(w);
    assert.equal((await json(await h.post('POST /api/handoff', await sendBody(w), { authorization: basic('rodrigo', 'secreto-rodrigo') }))).status, 201);
    const s = await w.snapshot(); const attemptId = s.attempts[0].id;
    const issued = await h.authorization.issueRecipientGrant(w.ctx({ kind: 'system' }, null, NOW, BEFORE, 'system'), w.ids.Paula,
      { entity: 'handoff', entityId: s.handoff.id, attemptId, actions: ['read_handoff', 'accept_handoff', 'reject_handoff'] });
    assert.ok(issued.ok);
    const bearer = { authorization: `Bearer ${issued.value.opaqueToken}` };
    const body = { executionId: w.prepared.executionId, idempotencyKey: 'acc', expectedVersion: s.handoff.version, attemptId };
    const params = { id: s.handoff.id };
    assert.equal((await json(await h.post('POST /api/handoff/[id]/accept', body, { ...bearer, origin: '' }, params))).body.error.code, 'ORIGIN_REJECTED');
    const wrongAttempt = await json(await h.post('POST /api/handoff/[id]/accept', { ...body, attemptId: 'handoff_attempt_otro' }, bearer, params));
    assert.equal(wrongAttempt.body.error.code, 'AUTH_INVALID');
    const ok = await json(await h.post('POST /api/handoff/[id]/accept', body, bearer, params));
    assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.data.coverage.status, 'scheduled');
    const replay = await json(await h.post('POST /api/handoff/[id]/accept', body, bearer, params));
    assert.deepEqual(replay.body.data, ok.body.data);
    const rejectScope = await json(await h.post('POST /api/handoff/[id]/reject', { ...body, idempotencyKey: 'rej' }, bearer, params));
    assert.equal(rejectScope.status, 409, 'aceptado: otra transición ya no corresponde');
    assert.equal((await w.snapshot()).events.filter(e => e.kind === 'handoff_accepted').length, 1);
  } finally { await w.close(); }
});

test('control debe indicar a quién representa; un intento vencido responde 410 y la derivación queda registrada', async () => {
  const w = await world(BASE_FIXTURE);
  try {
    const h = harness(w); const control = { authorization: basic('control', 'secreto-control') };
    assert.equal((await json(await h.post('POST /api/handoff', await sendBody(w), control))).status, 201);
    const s = await w.snapshot();
    const body = { executionId: w.prepared.executionId, idempotencyKey: 'c1', expectedVersion: s.handoff.version, attemptId: s.attempts[0].id };
    const params = { id: s.handoff.id };
    assert.equal((await json(await h.post('POST /api/handoff/[id]/accept', body, control, params))).body.error.code, 'INVALID_INPUT');
    h.clock.now = at(NOW, 30_000);
    const late = await json(await h.post('POST /api/handoff/[id]/accept', { ...body, representedActorId: w.ids.Paula }, control, params));
    assert.equal(late.status, 410); assert.equal(late.body.error.code, 'ACTION_EXPIRED');
    const after = await w.snapshot();
    assert.deepEqual(after.attempts.map(a => a.status), ['expired', 'pending'], 'tras el rechazo tardío se evalúan los plazos');
    assert.equal(after.coverage.status, 'unconfirmed');
  } finally { await w.close(); }
});
