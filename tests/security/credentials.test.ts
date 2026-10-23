import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateOpaqueToken, hashCredential, parseBasic, parseBearer, secretsEqual } from '../../src/lib/server/auth/credentials';

test('token opaco: 32 bytes base64url, único, y el hash es sha256 hex de 64 caracteres', () => {
  const a = generateOpaqueToken(), b = generateOpaqueToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  const h = hashCredential(a);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashCredential(a));
  assert.notEqual(h, hashCredential(b));
  assert.ok(!h.includes(a));
});

test('bearer: solo acepta el esquema Bearer con token base64url bien formado', () => {
  const t = generateOpaqueToken();
  assert.equal(parseBearer(`Bearer ${t}`), t);
  assert.equal(parseBearer(`bearer ${t}`), t);
  for (const bad of [null, '', 'Bearer', 'Bearer ', `Basic ${t}`, `Bearer ${t} extra`, 'Bearer corto', `Bearer ${t}$$`]) {
    assert.equal(parseBearer(bad), null, String(bad));
  }
});

test('basic: decodifica usuario y secreto, el secreto puede contener ":"', () => {
  const header = 'Basic ' + Buffer.from('rodrigo:se:creto').toString('base64');
  assert.deepEqual(parseBasic(header), { username: 'rodrigo', secret: 'se:creto' });
  for (const bad of [null, '', 'Basic', 'Basic !!!', 'Bearer abc', 'Basic ' + Buffer.from('sinsecreto').toString('base64'), 'Basic ' + Buffer.from(':x').toString('base64')]) {
    assert.equal(parseBasic(bad), null, String(bad));
  }
});

test('comparación de secretos: igual solo si coincide completo; vacío o ausente nunca coincide', () => {
  assert.equal(secretsEqual('abc', 'abc'), true);
  assert.equal(secretsEqual('abc', 'abd'), false);
  assert.equal(secretsEqual('abc', 'abcd'), false);
  assert.equal(secretsEqual('', ''), false);
  assert.equal(secretsEqual(undefined, 'x'), false);
  assert.equal(secretsEqual('x', undefined), false);
});
