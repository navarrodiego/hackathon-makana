import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAuthConfig } from '../../src/lib/server/auth/config';
import { authHeaders } from '../../src/lib/server/http/request';
import { jsonResponse } from '../../src/lib/server/http/response';
import { failure, success } from '../../src/lib/server/http/errors';

const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
const full = { RODRIGO_USERNAME: 'rodrigo', RODRIGO_SECRET: 'sr', CONTROL_USERNAME: 'control', CONTROL_SECRET: 'sc', APP_ORIGIN: 'https://relevo.example' };

test('configuración completa se carga; la ausencia de un par desactiva solo ese rol', () => {
  assert.deepEqual(loadAuthConfig(env(full)), { outgoing: { username: 'rodrigo', secret: 'sr' }, control: { username: 'control', secret: 'sc' }, appOrigin: 'https://relevo.example' });
  assert.equal(loadAuthConfig(env({ ...full, RODRIGO_SECRET: '' })).outgoing, undefined);
  assert.equal(loadAuthConfig(env({ ...full, CONTROL_USERNAME: ' ' })).control, undefined);
  assert.equal(loadAuthConfig(env({})).outgoing, undefined);
});

test('roles que comparten usuario o secreto se desactivan (no se adivina cuál es cuál)', () => {
  const same = loadAuthConfig(env({ ...full, CONTROL_USERNAME: 'rodrigo' }));
  assert.equal(same.outgoing, undefined); assert.equal(same.control, undefined);
  const sameSecret = loadAuthConfig(env({ ...full, CONTROL_SECRET: 'sr' }));
  assert.equal(sameSecret.outgoing, undefined); assert.equal(sameSecret.control, undefined);
});

test('APP_ORIGIN: solo origen exacto; https, o http únicamente en loopback', () => {
  for (const ok of ['https://relevo.example', 'https://relevo.example:8443', 'http://127.0.0.1:3000', 'http://localhost:3000', 'http://[::1]:3000']) {
    assert.equal(loadAuthConfig(env({ ...full, APP_ORIGIN: ok })).appOrigin, ok, ok);
  }
  for (const bad of ['http://relevo.example', 'https://relevo.example/', 'https://relevo.example/ruta', 'relevo.example', '*', 'https://user:pw@relevo.example', '']) {
    assert.equal(loadAuthConfig(env({ ...full, APP_ORIGIN: bad })).appOrigin, undefined, bad);
  }
});

test('cabeceras de autenticación: Authorization, Origin y solo la cookie relevo_session', () => {
  const req = new Request('https://relevo.example/api/handoff', { method: 'POST', headers: { authorization: 'Bearer abc', origin: 'https://relevo.example', cookie: 'a=1; relevo_session=tok; b=2' } });
  assert.deepEqual(authHeaders(req), { authorizationHeader: 'Bearer abc', originHeader: 'https://relevo.example', sessionCookie: 'tok' });
  assert.deepEqual(authHeaders(new Request('https://relevo.example/x')), { authorizationHeader: null, originHeader: null, sessionCookie: null });
  assert.equal(authHeaders(new Request('https://relevo.example/x', { headers: { cookie: 'relevo_session=a; relevo_session=b' } })).sessionCookie, null, 'cookie duplicada es ambigua');
});

test('respuesta JSON: status del contrato y cabeceras que evitan caché y fugas por referrer', async () => {
  const ok = jsonResponse(success({ a: 1 }, 201, 'correlation_1'));
  assert.equal(ok.status, 201);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(ok.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
  assert.match(ok.headers.get('content-type')!, /application\/json/);
  assert.deepEqual(await ok.json(), { ok: true, data: { a: 1 }, correlationId: 'correlation_1' });
  const bad = jsonResponse(failure('AUTH_EXPIRED', 'correlation_2'));
  assert.equal(bad.status, 401);
  assert.equal((await bad.json()).error.code, 'AUTH_EXPIRED');
});
