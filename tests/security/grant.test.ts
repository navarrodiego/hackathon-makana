import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CommandContext, RecipientGrant, RecipientScope } from '../../src/lib/contracts/auth';
import { buildRecipientGrant, createAuthorizationService, type AuthDeps } from '../../src/lib/server/auth/service';
import { hashCredential } from '../../src/lib/server/auth/credentials';

const T0 = '2026-10-23T15:00:00.000Z' as const;
const ctx = (principal: CommandContext['principal']): CommandContext => ({
  executionId: 'execution_now', executionVersion: 1, principal, actorId: null, origin: 'system',
  operationalNow: T0, narrativeNow: '2026-10-24T01:09:50.000Z', correlationId: 'correlation_g',
});
const SCOPE: RecipientScope = { entity: 'incident', entityId: 'incident_1', attemptId: 'incident_attempt_1', actions: ['take_incident'] };

test('la concesión vence a los 30 minutos exactos, guarda solo el hash y el token no aparece en ella', () => {
  const r = buildRecipientGrant(ctx({ kind: 'system' }), 'actor_incoming', SCOPE);
  assert.ok(r.ok);
  const { grant, opaqueToken } = r.value;
  assert.equal(grant.expiresAt, '2026-10-23T15:30:00.000Z'); assert.equal(grant.issuedAt, T0);
  assert.equal(grant.credentialHash, hashCredential(opaqueToken));
  assert.equal(grant.executionId, 'execution_now'); assert.equal(grant.actorId, 'actor_incoming');
  assert.ok(!JSON.stringify(grant).includes(opaqueToken));
});

test('solo sistema, control o saliente emiten; destinatario y reportante no', () => {
  for (const principal of [{ kind: 'system' }, { kind: 'control', operatorId: 'demo_control' }, { kind: 'outgoing', actorId: 'actor_outgoing' }] as const) {
    assert.equal(buildRecipientGrant(ctx(principal), 'actor_incoming', SCOPE).ok, true);
  }
  const recipientGrant = { executionId: 'execution_now', actorId: 'actor_incoming', scope: SCOPE, credentialHash: 'a'.repeat(64), issuedAt: T0, expiresAt: T0 } as RecipientGrant;
  for (const principal of [{ kind: 'recipient', actorId: 'actor_incoming', grant: recipientGrant }, { kind: 'reporter', sessionId: 'session_a' }] as const) {
    assert.deepEqual(buildRecipientGrant(ctx(principal), 'actor_incoming', SCOPE), { ok: false, code: 'FORBIDDEN' });
  }
});

test('el alcance debe ser coherente: incidente solo toma; relevo no toma; sin acciones no emite', () => {
  const bad = [
    { ...SCOPE, actions: ['take_incident', 'accept_handoff'] },
    { entity: 'handoff', entityId: 'handoff_1', attemptId: 'handoff_attempt_1', actions: ['take_incident'] },
    { entity: 'handoff', entityId: 'handoff_1', attemptId: 'handoff_attempt_1', actions: [] },
    { entity: 'incident', entityId: 'handoff_1', attemptId: 'incident_attempt_1', actions: ['take_incident'] },
  ] as unknown as RecipientScope[];
  for (const scope of bad) assert.deepEqual(buildRecipientGrant(ctx({ kind: 'system' }), 'actor_incoming', scope), { ok: false, code: 'INVALID_INPUT' });
});

test('issueRecipientGrant persiste mediante el puerto y propaga su fallo sin devolver token', async () => {
  const saved: RecipientGrant[] = [];
  const deps = { persistGrant: async (_: CommandContext, g: RecipientGrant) => { saved.push(g); return { ok: true, value: null } as const; } } as unknown as AuthDeps;
  const ok = await createAuthorizationService(deps).issueRecipientGrant(ctx({ kind: 'system' }), 'actor_incoming', SCOPE);
  assert.ok(ok.ok); assert.equal(saved.length, 1); assert.equal(saved[0].credentialHash, hashCredential(ok.value.opaqueToken));
  const failing = { persistGrant: async () => ({ ok: false, code: 'STORAGE_UNAVAILABLE' }) } as unknown as AuthDeps;
  assert.deepEqual(await createAuthorizationService(failing).issueRecipientGrant(ctx({ kind: 'system' }), 'actor_incoming', SCOPE), { ok: false, code: 'STORAGE_UNAVAILABLE' });
});
