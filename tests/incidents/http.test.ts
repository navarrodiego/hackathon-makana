import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { createPersistedAuthorization } from '../../src/lib/server/auth/persistence';
import { createRequestValidator } from '../../src/lib/server/http/validate';
import { handleAckRequest } from '../../src/lib/server/incidents/http';
import { at, factsKey, world } from './helpers';

const APP = 'http://127.0.0.1:3000';
const NOW = ACCEPTED_FIXTURE.operationalAt;
const N = '2026-10-24T01:10:01.000Z' as const;
const basic = (u: string, s: string) => `Basic ${Buffer.from(`${u}:${s}`).toString('base64')}`;
type W = Awaited<ReturnType<typeof world>>;

function harness(w: W) {
  const clock = { now: NOW as Instant };
  const config = { operatorSecret: 'secreto-operador', appOrigin: APP };
  const authorization = createPersistedAuthorization(w.store, config, () => clock.now);
  const deps = { authorization, service: w.service, validator: createRequestValidator(), now: () => clock.now };
  const post = (body: unknown, headers: Record<string, string>, params: unknown, raw?: string) =>
    handleAckRequest(deps, new Request(`${APP}/api/ack/x`, { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json', origin: APP, ...headers } }), params);
  return { clock, authorization, post };
}
const json = async (r: Response) => ({ status: r.status, body: await r.json(), headers: r.headers });

async function opened(w: W) {
  const r = await w.ingest(factsKey('no emite boletas'), NOW, N); assert.ok(r.ok && r.value.incident);
  return (await w.snapshot());
}
async function grantFor(w: W, h: ReturnType<typeof harness>, actor: keyof W['ids'], s: Awaited<ReturnType<W['snapshot']>>, attemptIndex = 0) {
  const issued = await h.authorization.issueRecipientGrant(w.system(NOW, N), w.ids[actor],
    { entity: 'incident', entityId: s.incidents[0].id, attemptId: s.attempts[attemptIndex].id, actions: ['take_incident'] });
  assert.ok(issued.ok); return { authorization: `Bearer ${issued.value.opaqueToken}` };
}

test('Paula toma con su enlace limitado; origen, token ajeno y JSON inválido no mutan (S01)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const h = harness(w); const s = await opened(w);
    const bearer = await grantFor(w, h, 'Paula', s);
    const params = { id: s.incidents[0].id };
    const body = { executionId: w.prepared.executionId, idempotencyKey: 'ack', expectedVersion: s.incidents[0].version, attemptId: s.attempts[0].id };
    assert.equal((await json(await h.post(body, { ...bearer, origin: 'https://evil.example' }, params))).body.error.code, 'ORIGIN_REJECTED');
    assert.equal((await json(await h.post(body, bearer, params, '{no json'))).body.error.code, 'INVALID_INPUT');
    assert.equal((await json(await h.post(body, {}, params))).body.error.code, 'AUTH_REQUIRED');
    assert.equal((await json(await h.post({ ...body, attemptId: 'incident_attempt_otro' }, bearer, params))).body.error.code, 'AUTH_INVALID');
    assert.equal((await w.snapshot()).incidents[0].status, 'awaiting_ack', 'ningún rechazo mutó');
    const ok = await json(await h.post(body, bearer, params));
    assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.data.incident.status, 'taken');
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(JSON.stringify(ok.body), /secreto|bearer|opaque/i);
    const replay = await json(await h.post(body, bearer, params));
    assert.deepEqual(replay.body.data, ok.body.data);
    assert.equal((await w.snapshot()).events.filter(e => e.kind === 'incident_taken').length, 1);
  } finally { await w.close(); }
});

test('acuse tardío por HTTP: 410, y la escalada queda registrada sin esperar un GET de estado (I03)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const h = harness(w); const s = await opened(w);
    const bearer = await grantFor(w, h, 'Paula', s);
    h.clock.now = at(NOW, 30_000);
    const late = await json(await h.post({ executionId: w.prepared.executionId, idempotencyKey: 'late', expectedVersion: s.incidents[0].version, attemptId: s.attempts[0].id }, bearer, { id: s.incidents[0].id }));
    assert.equal(late.status, 410); assert.equal(late.body.error.code, 'ACTION_EXPIRED');
    const after = await w.snapshot();
    assert.deepEqual(after.attempts.map(a => a.status), ['expired', 'pending']);
    assert.equal(after.attempts[1].candidateActorId, w.ids.Tomás);
    assert.equal(after.incidents[0].takenBy, null);
  } finally { await w.close(); }
});

test('control debe indicar a quién representa y deja origen escenario (S01)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const h = harness(w); const s = await opened(w); const control = { authorization: basic('control', 'secreto-operador') };
    const body = { executionId: w.prepared.executionId, idempotencyKey: 'c1', expectedVersion: s.incidents[0].version, attemptId: s.attempts[0].id };
    const params = { id: s.incidents[0].id };
    assert.equal((await json(await h.post(body, control, params))).body.error.code, 'INVALID_INPUT');
    const ok = await json(await h.post({ ...body, representedActorId: w.ids.Paula }, control, params));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await w.snapshot()).events.find(e => e.kind === 'incident_taken')!.origin, 'scenario');
  } finally { await w.close(); }
});

test('el token de otro intento o de un relevo no toma el incidente (S01)', async () => {
  const w = await world(ACCEPTED_FIXTURE);
  try {
    const h = harness(w); const s = await opened(w);
    // Un token de relevo, aunque sea de Paula, no abre el acuse.
    const issued = await h.authorization.issueRecipientGrant(w.system(NOW, N), w.ids.Paula,
      { entity: 'handoff', entityId: s.handoff.id, attemptId: 'handoff_attempt_x' as never, actions: ['read_handoff', 'accept_handoff'] });
    const body = { executionId: w.prepared.executionId, idempotencyKey: 'x', expectedVersion: s.incidents[0].version, attemptId: s.attempts[0].id };
    if (issued.ok) { // si T05 lo emitiera, el alcance de relevo no debe abrir el acuse
      const r = await json(await h.post(body, { authorization: `Bearer ${issued.value.opaqueToken}` }, { id: s.incidents[0].id }));
      assert.ok(r.status === 401 || r.status === 403, JSON.stringify(r.body));
    }
    // Un token de incidente solo se emite al candidato del intento: a Tomás sobre el intento de Paula se le niega.
    const other = await h.authorization.issueRecipientGrant(w.system(NOW, N), w.ids.Tomás,
      { entity: 'incident', entityId: s.incidents[0].id, attemptId: s.attempts[0].id, actions: ['take_incident'] });
    assert.equal(other.ok, false, 'no se emite token de incidente a quien no es el candidato del intento');
    assert.equal((await w.snapshot()).incidents[0].status, 'awaiting_ack');
  } finally { await w.close(); }
});
