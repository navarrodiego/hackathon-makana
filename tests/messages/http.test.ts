import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Instant } from '../../src/lib/contracts/core';
import { createPersistedAuthorization } from '../../src/lib/server/auth/persistence';
import { createRequestValidator } from '../../src/lib/server/http/validate';
import { handleMessageRequest } from '../../src/lib/server/messages/http';
import { createPublicSessionService } from '../../src/lib/server/messages/session';
import { world } from './helpers';

const APP = 'http://127.0.0.1:3000';
const basic = (u: string, s: string) => `Basic ${Buffer.from(`${u}:${s}`).toString('base64')}`;
type W = Awaited<ReturnType<typeof world>>;

async function harness(w: W) {
  const now = new Date().toISOString() as Instant;
  const config = { operatorSecret: 'secreto-operador', appOrigin: APP };
  const authorization = createPersistedAuthorization(w.store, config, () => now);
  const sessions = createPublicSessionService({ store: w.store });
  const entered = await sessions.enter(null, now);
  assert.ok(entered.ok && entered.value.newOpaqueCookie);
  const cookie = `relevo_session=${entered.value.newOpaqueCookie}`;
  const deps = { authorization, service: w.service, validator: createRequestValidator() };
  const body = (text = 'Local 7 caja 2 no emite boletas', key = 'h1') => ({ executionId: w.prepared.executionId, idempotencyKey: key, nickname: 'Visita', text });
  const post = (payload: unknown, headers: Record<string, string> = {}, raw?: string) =>
    handleMessageRequest(deps, new Request(`${APP}/api/messages`, { method: 'POST', body: raw ?? JSON.stringify(payload), headers: { 'content-type': 'application/json', origin: APP, cookie, ...headers } }));
  return { post, body, cookie, now, entered: entered.value };
}
const json = async (r: Response) => ({ status: r.status, body: await r.json(), headers: r.headers });

test('POST /api/messages: sesión pública admite y devuelve recibo 201 sin caché (A08/S03)', async () => {
  const w = await world();
  try {
    const h = await harness(w);
    const ok = await json(await h.post(h.body()));
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.data.audience, 'reporter');
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(JSON.stringify(ok.body), /relevo_session|secreto|opaque|token/i);
    const replay = await json(await h.post(h.body()));
    assert.deepEqual(replay.body.data, ok.body.data);
    assert.equal((await w.snapshot()).reports.length, 1);
  } finally { await w.close(); }
});

test('rechazos sin efecto: origen ajeno, sin cookie, cookie inventada, JSON inválido, 281 caracteres, apodo largo, HTML (A08)', async () => {
  const w = await world();
  try {
    const h = await harness(w);
    const code = async (p: Promise<Response>) => (await json(await p)).body.error?.code;
    assert.equal(await code(h.post(h.body(), { origin: 'https://evil.example' })), 'ORIGIN_REJECTED');
    assert.equal(await code(h.post(h.body(), { cookie: '' })), 'AUTH_REQUIRED');
    assert.equal(await code(h.post(h.body(), { cookie: `relevo_session=${'a'.repeat(43)}` })), 'AUTH_INVALID');
    assert.equal(await code(h.post(null, {}, '{no json')), 'INVALID_INPUT');
    assert.equal(await code(h.post(h.body('x'.repeat(281)))), 'INVALID_INPUT');
    assert.equal(await code(h.post({ ...h.body(), nickname: 'n'.repeat(41) })), 'INVALID_INPUT');
    assert.equal(await code(h.post({ ...h.body(), nickname: '' })), 'INVALID_INPUT');
    assert.equal(await code(h.post({ ...h.body(), extra: 'x' })), 'INVALID_INPUT');
    assert.equal((await w.snapshot()).reports.length, 0, 'ningún rechazo creó un reporte ni gastó cuota');
    assert.equal((await w.snapshot()).execution.admittedReports, 0);
    const xss = await json(await h.post(h.body('<img src=x onerror=alert(1)> Local 7 no emite boletas', 'x1')));
    assert.equal(xss.status, 201);
    assert.equal((await w.snapshot()).reports[0].text, '<img src=x onerror=alert(1)> Local 7 no emite boletas', 'se conserva como texto, sin filtrar el hecho');
  } finally { await w.close(); }
});

test('canal cerrado por HTTP: 409 CHANNEL_CLOSED y nada gastado', async () => {
  const w = await world({ ...(await import('./helpers')).OPEN_FIXTURE, channelOpen: false });
  try {
    const h = await harness(w);
    const r = await json(await h.post(h.body()));
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'CHANNEL_CLOSED');
    assert.equal((await w.snapshot()).execution.admittedReports, 0);
  } finally { await w.close(); }
});

test('control envía con Basic y origen escenario; Rodrigo no puede (C12)', async () => {
  const w = await world();
  try {
    const h = await harness(w);
    const asControl = await json(await h.post(h.body('Reporte guionado impresora', 'k-control'), { cookie: '', authorization: basic('control', 'secreto-operador') }));
    assert.equal(asControl.status, 201, JSON.stringify(asControl.body));
    assert.equal((await w.snapshot()).reports[0].origin, 'scenario');
    const asOutgoing = await json(await h.post(h.body('Orden', 'k-out'), { cookie: '', authorization: basic('rodrigo', 'secreto-operador') }));
    assert.equal(asOutgoing.body.error.code, 'FORBIDDEN');
  } finally { await w.close(); }
});

test('canal: una credencial Basic guardada por el navegador no cambia a quién se atribuye el reporte (C12)', async () => {
  const w = await world();
  try {
    const h = await harness(w);
    const canal = { 'x-relevo-canal': '1' };
    const withControl = await json(await h.post(h.body('Local 7 caja 2 no emite boletas', 'k-c1'), { ...canal, authorization: basic('control', 'secreto-operador') }));
    assert.equal(withControl.status, 201, JSON.stringify(withControl.body));
    assert.equal(withControl.body.data.audience, 'reporter');
    const [report] = (await w.snapshot()).reports;
    assert.equal(report.origin, 'web');
    assert.equal(report.sessionId, h.entered.sessionId, 'queda en la sesión de la cookie, no en la de escenario');
    const withOutgoing = await json(await h.post(h.body('Local 8 caja 1 no emite boletas', 'k-c2'), { ...canal, authorization: basic('rodrigo', 'secreto-operador') }));
    assert.equal(withOutgoing.status, 201, JSON.stringify(withOutgoing.body));
    const noCookie = await json(await h.post(h.body('Local 9 caja 3 no emite boletas', 'k-c3'), { ...canal, cookie: '', authorization: basic('control', 'secreto-operador') }));
    assert.equal(noCookie.body.error.code, 'AUTH_REQUIRED', 'sin cookie no cae en control');
    assert.equal((await w.snapshot()).reports.length, 2);
  } finally { await w.close(); }
});
