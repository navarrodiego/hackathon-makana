import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import { ACCEPTED_FIXTURE } from '../../src/lib/contracts/fixtures';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import type { CommandContext, RecipientGrant } from '../../src/lib/contracts/auth';
import type { StoredNote } from '../../src/lib/contracts/domain';
config({ path: '.env.t03', quiet: true });

test('concesiones y nota guardada conservan alcance y versión sin almacenar token crudo', async () => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!;
  const db = localClient(url), fixtures = fixturePreparer(db, url), store = new PostgresPersistence(db);
  const p = await fixtures.prepare(ACCEPTED_FIXTURE);
  const c: CommandContext = { executionId: p.executionId, executionVersion: 1, principal: { kind: 'system' }, actorId: null, origin: 'system', operationalNow: ACCEPTED_FIXTURE.operationalAt, narrativeNow: ACCEPTED_FIXTURE.narrativeAt, correlationId: 'correlation_credentials' };
  const grant = { executionId: p.executionId, actorId: p.handoff.acceptedBy!, scope: { entity: 'handoff', entityId: p.handoff.id, attemptId: p.handoff.currentAttemptId!, actions: ['read_handoff', 'accept_handoff'] }, credentialHash: 'd'.repeat(64), issuedAt: c.operationalNow, expiresAt: '2026-10-23T15:30:00.000Z' } as const satisfies RecipientGrant;
  try {
    const saved = await store.run(c, async r => {
      await r.credentials.saveGrant(grant);
      const session = await db.$queryRaw<{ credentialHash: string }[]>`SELECT "credentialHash" FROM report_sessions WHERE id=${p.sessionId}`;
      assert.equal((await r.credentials.findSession(session[0].credentialHash))?.id, p.sessionId);
      const attempt = (await r.aggregates.handoffAttempts.list())[0];
      assert.equal(await r.aggregates.handoffAttempts.compareAndSwap({ ...attempt, version: 2 }, { executionId: p.executionId, version: 1, status: attempt.status, candidateActorId: 'actor_wrong' }), false);
      const note: StoredNote = { executionId: p.executionId, version: 2, output: { note: 'Nota sintética producida por un doble explícito de prueba.', suggestions: (await r.aggregates.tickets.list()).map(t => ({ ticketId: t.id, disposition: t.disposition, reason: 'Datos de prueba.' })) }, provenance: { provider: 'openrouter', api: 'structured_chat', model: 'test-double', configurationId: 'test-only' }, generatedAt: c.operationalNow };
      assert.equal(await r.notes.save(note, 99), false);
      assert.equal(await r.notes.save(note, 1), true);
      assert.deepEqual(await r.notes.get(), note);
      return { ok: true, value: null };
    });
    assert.equal(saved.ok, true);
    assert.deepEqual(await store.findGrant(grant.credentialHash), grant);
    for (const bad of [
      { ...grant, credentialHash: 'raw-token' },
      { ...grant, credentialHash: 'e'.repeat(64), expiresAt: '2026-10-23T15:30:00.001Z' as const },
      { ...grant, credentialHash: 'f'.repeat(64), scope: { ...grant.scope, attemptId: 'handoff_attempt_foreign' as const } },
    ]) {
      const rejected = await store.run(c, async r => { await r.credentials.saveGrant(bad); return { ok: true, value: null }; });
      assert.deepEqual(rejected, { ok: false, code: 'STORAGE_UNAVAILABLE' });
    }
  } finally { await fixtures.dispose(p.executionId); await db.$disconnect(); }
});
