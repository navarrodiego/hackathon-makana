import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERROR_STATUS, type ErrorCode } from '../../src/lib/contracts/http';
import { failure, success } from '../../src/lib/server/http/errors';
import { checkOrigin } from '../../src/lib/server/http/origin';

const correlationId = 'correlation_test';

test('cada código del catálogo tiene status y mensaje propio sin datos privados', () => {
  const messages = new Set<string>();
  for (const code of Object.keys(ERROR_STATUS) as ErrorCode[]) {
    const f = failure(code, correlationId);
    assert.equal(f.status, ERROR_STATUS[code]);
    assert.deepEqual(f.body, { ok: false, error: { code, message: f.body.error.message }, correlationId });
    assert.ok(f.body.error.message.length > 10);
    assert.doesNotMatch(f.body.error.message, /token|bearer|basic|sql|secret/i);
    messages.add(f.body.error.message);
  }
  assert.equal(messages.size, Object.keys(ERROR_STATUS).length);
});

test('success conserva status y correlación', () => {
  assert.deepEqual(success({ a: 1 }, 201, correlationId), { status: 201, body: { ok: true, data: { a: 1 }, correlationId } });
});

const APP = 'https://relevo.example';
test('origen: debe coincidir exactamente con APP_ORIGIN', () => {
  assert.equal(checkOrigin({ origin: APP, appOrigin: APP, allowMissing: false }), true);
  for (const bad of [null, 'null', 'https://evil.example', 'http://relevo.example', 'https://relevo.example:8443', 'https://relevo.example/', '']) {
    assert.equal(checkOrigin({ origin: bad, appOrigin: APP, allowMissing: false }), false, String(bad));
  }
});

test('origen: ausente solo se tolera si el llamador lo permite; presente y ajeno siempre se rechaza', () => {
  assert.equal(checkOrigin({ origin: null, appOrigin: APP, allowMissing: true }), true);
  assert.equal(checkOrigin({ origin: 'https://evil.example', appOrigin: APP, allowMissing: true }), false);
  assert.equal(checkOrigin({ origin: 'null', appOrigin: APP, allowMissing: true }), false);
});

test('origen: sin APP_ORIGIN configurado falla cerrado', () => {
  assert.equal(checkOrigin({ origin: APP, appOrigin: undefined, allowMissing: true }), false);
  assert.equal(checkOrigin({ origin: null, appOrigin: '', allowMissing: true }), false);
});
