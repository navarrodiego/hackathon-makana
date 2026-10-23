import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAuthConfig } from '../../src/lib/server/auth/config';
import { authHeaders } from '../../src/lib/server/http/request';
import { jsonResponse } from '../../src/lib/server/http/response';
import { failure, success } from '../../src/lib/server/http/errors';

const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
const full = { OPERATOR_SECRET: 'secreto-operador', APP_ORIGIN: 'https://relevo.example' };

test('contraseña de operador: se carga recortada; ausente o corta deja el acceso cerrado', () => {
  assert.deepEqual(loadAuthConfig(env(full)), { operatorSecret: 'secreto-operador', appOrigin: 'https://relevo.example' });
  assert.equal(loadAuthConfig(env({ ...full, OPERATOR_SECRET: '  secreto-operador\n' })).operatorSecret, 'secreto-operador', 'salto de línea pegado');
  assert.equal(loadAuthConfig(env({ ...full, OPERATOR_SECRET: 'corta' })).operatorSecret, undefined);
  assert.equal(loadAuthConfig(env({ ...full, OPERATOR_SECRET: '   ' })).operatorSecret, undefined);
  assert.equal(loadAuthConfig(env({})).operatorSecret, undefined);
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
  const none = { outgoing: null, control: null };
  assert.deepEqual(authHeaders(req), { authorizationHeader: 'Bearer abc', originHeader: 'https://relevo.example', sessionCookie: 'tok', operatorCookies: none });
  assert.deepEqual(authHeaders(new Request('https://relevo.example/x')), { authorizationHeader: null, originHeader: null, sessionCookie: null, operatorCookies: none });
  const ops = authHeaders(new Request('https://relevo.example/x', { headers: { cookie: 'relevo_op_rodrigo=r1; relevo_op_control=c1; relevo_op_control=c2' } }));
  assert.deepEqual(ops.operatorCookies, { outgoing: 'r1', control: null }, 'cookie de operador duplicada es ambigua');
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
