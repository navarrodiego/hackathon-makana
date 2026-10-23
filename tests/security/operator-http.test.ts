import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleOperatorLogin, handleOperatorLogout, type OperatorHttpDeps } from '../../src/lib/server/auth/operator-http';
import { verifyOperatorToken } from '../../src/lib/server/auth/operator-session';

const APP = 'https://relevo.example', SECRET = 'secreto-operador', NOW = Date.parse('2026-10-23T15:00:00.000Z');

function deps(over: Partial<OperatorHttpDeps> = {}) {
  let delays = 0;
  const d: OperatorHttpDeps = { config: { operatorSecret: SECRET, appOrigin: APP }, nowMs: () => NOW, failureDelay: async () => { delays++; }, ...over };
  return { d, delays: () => delays };
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => new Request(`${APP}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', origin: APP, ...headers }, body: JSON.stringify(body),
});
const login = (body: unknown, headers?: Record<string, string>, over?: Partial<OperatorHttpDeps>) => {
  const w = deps(over);
  return handleOperatorLogin(w.d, post('/api/acceso', body, headers)).then(async r => ({ r, json: await r.json(), delays: w.delays() }));
};
const tokenOf = (setCookie: string | null, name: string) => setCookie?.match(new RegExp(`^${name}=([^;]*)`))?.[1];

test('ingreso: contraseña correcta emite la cookie del rol pedido, HttpOnly, Lax, Secure y 12 h', async () => {
  const { r, json } = await login({ role: 'outgoing', secret: SECRET });
  assert.equal(r.status, 200); assert.equal(json.data.role, 'outgoing');
  const set = r.headers.get('set-cookie');
  assert.match(set!, /^relevo_op_rodrigo=/);
  assert.match(set!, /; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure$/);
  assert.equal(verifyOperatorToken(tokenOf(set, 'relevo_op_rodrigo'), 'outgoing', SECRET, NOW), true);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const ctl = await login({ role: 'control', secret: ` ${SECRET} ` });
  assert.match(ctl.r.headers.get('set-cookie')!, /^relevo_op_control=/, 'espacios pegados alrededor se toleran');
});

test('ingreso: contraseña incorrecta responde AUTH_INVALID, espera y no emite cookie', async () => {
  const { r, json, delays } = await login({ role: 'control', secret: 'otra' });
  assert.equal(r.status, 401); assert.equal(json.error.code, 'AUTH_INVALID');
  assert.equal(r.headers.get('set-cookie'), null); assert.equal(delays, 1);
});

test('ingreso: sin contraseña configurada responde AUTH_NOT_CONFIGURED', async () => {
  const { r, json } = await login({ role: 'outgoing', secret: SECRET }, {}, { config: { operatorSecret: undefined, appOrigin: APP } });
  assert.equal(r.status, 503); assert.equal(json.error.code, 'AUTH_NOT_CONFIGURED');
});

test('ingreso: origen ajeno o APP_ORIGIN ausente se rechaza mostrando el origen esperado y el recibido', async () => {
  const other = await login({ role: 'outgoing', secret: SECRET }, { origin: 'https://www.relevo.example' });
  assert.equal(other.r.status, 403); assert.equal(other.json.error.code, 'ORIGIN_REJECTED');
  assert.deepEqual(other.json.origin, { expected: APP, received: 'https://www.relevo.example' });
  assert.equal(other.r.headers.get('set-cookie'), null);
  const unset = await login({ role: 'outgoing', secret: SECRET }, {}, { config: { operatorSecret: SECRET, appOrigin: undefined } });
  assert.deepEqual(unset.json.origin, { expected: null, received: APP });
  assert.ok(!JSON.stringify(unset.json).includes(SECRET));
});

test('ingreso: cuerpo inválido o rol desconocido', async () => {
  for (const body of [{}, { role: 'tomas', secret: SECRET }, { role: 'outgoing' }, { role: 'outgoing', secret: 'x'.repeat(513) }, []]) {
    assert.equal((await login(body)).json.error.code, 'INVALID_INPUT', JSON.stringify(body));
  }
  const text = await handleOperatorLogin(deps().d, new Request(`${APP}/api/acceso`, { method: 'POST', headers: { origin: APP, 'content-type': 'text/plain' }, body: 'role=outgoing' }));
  assert.equal(text.status, 400);
});

test('salir: borra las sesiones de ambos roles, aunque APP_ORIGIN falle', async () => {
  const r = await handleOperatorLogout(post('/api/acceso/salir', {}, { origin: 'https://otro.example' }));
  assert.equal(r.status, 200);
  const set = r.headers.getSetCookie();
  assert.equal(set.length, 2);
  assert.ok(set.some(c => /^relevo_op_rodrigo=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/.test(c)));
  assert.ok(set.some(c => /^relevo_op_control=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/.test(c)));
  const text = await handleOperatorLogout(new Request(`${APP}/api/acceso/salir`, { method: 'POST', body: 'x' }));
  assert.equal(text.status, 400, 'sin JSON no hay preflight: se rechaza');
});

const formPost = (fields: Record<string, string>, headers: Record<string, string> = {}) => new Request(`${APP}/api/acceso`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: APP, ...headers }, body: new URLSearchParams(fields).toString(),
});

test('formulario sin JavaScript: éxito vuelve a la página del rol con la cookie; la contraseña nunca va en la URL', async () => {
  const ok = await handleOperatorLogin(deps().d, formPost({ role: 'control', secret: SECRET, username: 'operador-relevo' }));
  assert.equal(ok.status, 303); assert.equal(ok.headers.get('location'), '/control');
  assert.match(ok.headers.get('set-cookie')!, /^relevo_op_control=/);
  const bad = await handleOperatorLogin(deps().d, formPost({ role: 'outgoing', secret: 'otra' }));
  assert.equal(bad.status, 303); assert.equal(bad.headers.get('location'), '/rodrigo?acceso=AUTH_INVALID');
  assert.equal(bad.headers.get('set-cookie'), null);
  const origin = await handleOperatorLogin(deps().d, formPost({ role: 'outgoing', secret: SECRET }, { origin: 'https://otro.example' }));
  assert.equal(origin.headers.get('location'), '/rodrigo?acceso=ORIGIN_REJECTED');
  for (const r of [ok, bad, origin]) assert.ok(!(r.headers.get('location') ?? '').includes(SECRET));
});
