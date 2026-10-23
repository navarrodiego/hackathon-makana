import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS } from '../../src/lib/contracts/core';
import { issueOperatorToken, verifyOperatorToken } from '../../src/lib/server/auth/operator-session';

const SECRET = 'secreto-operador', T0 = Date.parse('2026-10-23T15:00:00.000Z');

test('sesión de operador: el token emitido vale para su rol hasta su expiración', () => {
  const token = issueOperatorToken('outgoing', SECRET, T0);
  assert.equal(verifyOperatorToken(token, 'outgoing', SECRET, T0), true);
  assert.equal(verifyOperatorToken(token, 'outgoing', SECRET, T0 + LIMITS.sessionMaxAgeMs - 1), true);
  assert.equal(verifyOperatorToken(token, 'outgoing', SECRET, T0 + LIMITS.sessionMaxAgeMs), false, 'expirado');
  assert.notEqual(issueOperatorToken('outgoing', SECRET, T0), token, 'cada emisión es distinta');
  assert.ok(!token.includes(SECRET));
});

test('sesión de operador: el rol va firmado; un token de Rodrigo no abre control', () => {
  const rodrigo = issueOperatorToken('outgoing', SECRET, T0);
  assert.equal(verifyOperatorToken(rodrigo, 'control', SECRET, T0), false);
  const forged = rodrigo.replace('.outgoing.', '.control.');
  assert.equal(verifyOperatorToken(forged, 'control', SECRET, T0), false);
});

test('sesión de operador: cambiar la contraseña invalida los tokens anteriores', () => {
  const token = issueOperatorToken('control', SECRET, T0);
  assert.equal(verifyOperatorToken(token, 'control', 'otra-contrasena', T0), false);
  assert.equal(verifyOperatorToken(token, 'control', undefined, T0), false, 'sin contraseña configurada nada vale');
});

test('sesión de operador: tokens alterados o malformados no valen', () => {
  const token = issueOperatorToken('control', SECRET, T0);
  const parts = token.split('.');
  const later = [parts[0], parts[1], String(Number(parts[2]) + 1000), parts[3], parts[4]].join('.');
  for (const bad of [null, undefined, '', 'v1', later, token + 'x', token.replace(/^v1/, 'v2'), parts.slice(0, 4).join('.'), `${token}.extra`]) {
    assert.equal(verifyOperatorToken(bad, 'control', SECRET, T0), false, String(bad));
  }
});
