import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Instant } from '../../src/lib/contracts/core';
import { hashCredential } from '../../src/lib/server/auth/credentials';
import { createPublicSessionService } from '../../src/lib/server/messages/session';
import { at, world } from './helpers';

test('entrada al canal: emite una sesión opaca, guarda solo su hash y la reutiliza', async () => {
  const w = await world();
  try {
    const sessions = createPublicSessionService({ store: w.store });
    const now = new Date().toISOString() as Instant;
    const first = await sessions.enter(null, now);
    assert.ok(first.ok && first.value.newOpaqueCookie);
    const token = first.value.newOpaqueCookie;
    assert.equal(token.length, 43);
    assert.equal(Date.parse(first.value.expiresAt) - Date.parse(now), 43_200_000);
    const stored = await w.store.findSession(hashCredential(token));
    assert.equal(stored?.id, first.value.sessionId);
    assert.ok(!JSON.stringify(stored).includes(token), 'el token crudo no se persiste');
    const again = await sessions.enter(token, at(now, 1000));
    assert.ok(again.ok);
    assert.equal(again.value.sessionId, first.value.sessionId);
    assert.equal(again.value.newOpaqueCookie, null);
  } finally { await w.close(); }
});

test('cookie inventada, mal formada o vencida: emite otra sesión, no acepta la anterior', async () => {
  const w = await world();
  try {
    const sessions = createPublicSessionService({ store: w.store });
    const now = new Date().toISOString() as Instant;
    const first = await sessions.enter(null, now);
    assert.ok(first.ok && first.value.newOpaqueCookie);
    for (const cookie of ['corto', 'a'.repeat(43), first.value.newOpaqueCookie]) {
      const later = await sessions.enter(cookie, cookie === first.value.newOpaqueCookie ? at(now, 43_200_000) : now);
      assert.ok(later.ok && later.value.newOpaqueCookie, `cookie ${cookie.slice(0, 6)}`);
      assert.notEqual(later.value.sessionId, first.value.sessionId);
    }
  } finally { await w.close(); }
});
