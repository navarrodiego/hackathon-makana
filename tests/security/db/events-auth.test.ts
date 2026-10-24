import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../../scripts/db/client';
import { fixturePreparer } from '../../helpers/db/fixtures';
import { ACCEPTED_FIXTURE } from '../../../src/lib/contracts/fixtures';
import type { CommandContext } from '../../../src/lib/contracts/auth';
import { PostgresPersistence } from '../../../src/lib/server/repositories';
import { recordEvent, registerNotificationIntent } from '../../../src/lib/server/events';
import { createPersistedAuthorization, persistenceDirectory } from '../../../src/lib/server/auth/persistence';
config({ path: '.env.db', quiet: true });

const APP = 'https://relevo.example';
const NOW = ACCEPTED_FIXTURE.operationalAt;
function setup() {
  const url = process.env.RELEVO_BACKEND_TEST_URL;
  if (!url) throw new Error('Falta RELEVO_BACKEND_TEST_URL: estas pruebas no se omiten sin base local de pruebas.');
  const db = localClient(url);
  return { db, fixtures: fixturePreparer(db, url), store: new PostgresPersistence(db) };
}
const system = (executionId: CommandContext['executionId']): CommandContext => ({
  executionId, executionVersion: 1, principal: { kind: 'system' }, actorId: null, origin: 'system',
  operationalNow: NOW, narrativeNow: ACCEPTED_FIXTURE.narrativeAt, correlationId: 'correlation_db',
});

test('un evento se confirma o se revierte junto con la unidad de trabajo del consumidor', async () => {
  const { db, fixtures, store } = setup(); const p = await fixtures.prepare(ACCEPTED_FIXTURE); const c = system(p.executionId);
  const input = { kind: 'handoff_sent', entity: { kind: 'handoff', id: p.handoff.id }, entityVersion: 2, channel: 'system', details: { kind: 'record' }, result: 'recorded' } as const;
  const count = async () => { const r = await store.run(c, async tx => ({ ok: true, value: (await tx.events.list()).length })); assert.ok(r.ok); return r.value; };
  try {
    const before = await count();
    const rejected = await store.run(c, async tx => { await recordEvent(tx, c, input); return { ok: false, code: 'STATE_CONFLICT' }; });
    assert.deepEqual(rejected, { ok: false, code: 'STATE_CONFLICT' });
    assert.equal(await count(), before, 'ok:false no deja evento');
    const crashed = await store.run(c, async tx => { await recordEvent(tx, c, input); throw new Error('fallo del consumidor'); });
    assert.deepEqual(crashed, { ok: false, code: 'STORAGE_UNAVAILABLE' });
    assert.equal(await count(), before, 'una excepción no deja evento');
    const committed = await store.run(c, async tx => ({ ok: true, value: await recordEvent(tx, c, input) }));
    assert.ok(committed.ok); assert.equal(committed.value.executionId, p.executionId); assert.equal(committed.value.sequence, before + 1);
    assert.equal(await count(), before + 1);
  } finally { await fixtures.dispose(p.executionId); await db.$disconnect(); }
});

test('intenciones concurrentes con la misma clave lógica crean una sola intención y un solo evento', async () => {
  const { db, fixtures, store } = setup(); const p = await fixtures.prepare(ACCEPTED_FIXTURE); const c = system(p.executionId);
  const subject = { kind: 'handoff', id: p.handoff.id, attemptId: p.handoff.currentAttemptId! } as const;
  try {
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      store.run(c, async tx => ({ ok: true, value: await registerNotificationIntent(tx, c, { subject, recipientActorId: p.handoff.acceptedBy!, channel: 'in_app' }) }))));
    const values = results.map(r => { assert.ok(r.ok); return r.value; });
    assert.equal(values.filter(v => v.created).length, 1);
    assert.equal(new Set(values.map(v => v.intent.id)).size, 1);
    const stored = await store.run(c, async tx => ({ ok: true, value: { intents: await tx.aggregates.notifications.list(), events: (await tx.events.list()).filter(e => e.kind === 'notification_intended') } }));
    assert.ok(stored.ok); assert.equal(stored.value.intents.length, 1); assert.equal(stored.value.events.length, 1);
  } finally { await fixtures.dispose(p.executionId); await db.$disconnect(); }
});

test('concesión real: se guarda solo el hash, autoriza su alcance y no otra ejecución', async () => {
  const { db, fixtures, store } = setup(); const p = await fixtures.prepare(ACCEPTED_FIXTURE); const c = system(p.executionId);
  const auth = createPersistedAuthorization(store, { operatorSecret: 'secreto-operador', appOrigin: APP }, () => NOW);
  const candidate = p.handoff.acceptedBy!, handoffId = p.handoff.id, attemptId = p.handoff.currentAttemptId!;
  try {
    const issued = await auth.issueRecipientGrant(c, candidate, { entity: 'handoff', entityId: handoffId, attemptId, actions: ['read_handoff', 'accept_handoff', 'reject_handoff'] });
    assert.ok(issued.ok);
    const { opaqueToken } = issued.value;
    const rows = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM recipient_grants WHERE "credentialHash"=${issued.value.grant.credentialHash}`;
    assert.equal(rows[0].n, 1);
    const leaked = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM recipient_grants WHERE "credentialHash" = $1`, opaqueToken);
    assert.equal(leaked[0].n, 0, 'el token crudo no está persistido');
    const input = { route: 'POST /api/handoff/[id]/accept', executionId: p.executionId, authorizationHeader: `Bearer ${opaqueToken}`, sessionCookie: null, originHeader: APP, entityId: handoffId, attemptId } as const;
    const ok = await auth.authorize(input);
    assert.ok(ok.ok); assert.equal(ok.value.actorId, candidate); assert.equal(ok.value.principal.kind, 'recipient');
    assert.deepEqual(await auth.authorize({ ...input, entityId: 'handoff_ajeno' }), { ok: false, code: 'AUTH_INVALID' });
    assert.deepEqual(await auth.authorize({ ...input, executionId: 'execution_retirada' }), { ok: false, code: 'AUTH_INVALID' }, 'token cruzado con otra ejecución');
    const basicRodrigo = 'Basic ' + Buffer.from('rodrigo:secreto-operador').toString('base64');
    assert.deepEqual(await auth.authorize({ route: 'POST /api/handoff', executionId: 'execution_retirada', authorizationHeader: basicRodrigo, sessionCookie: null, originHeader: APP }), { ok: false, code: 'EXECUTION_STALE' });
    const rodrigo = await auth.authorize({ route: 'POST /api/handoff', executionId: p.executionId, authorizationHeader: 'Basic ' + Buffer.from('rodrigo:secreto-operador').toString('base64'), sessionCookie: null, originHeader: APP });
    assert.ok(rodrigo.ok); assert.equal(rodrigo.value.actorId, p.handoff.outgoingActorId);
    const directory = persistenceDirectory(store);
    assert.equal(await directory.outgoingActorId(p.executionId), p.handoff.outgoingActorId);
    assert.equal(await directory.actorExists(p.executionId, candidate), true);
    assert.equal(await directory.actorExists(p.executionId, 'actor_inexistente'), false);
    assert.equal(await directory.outgoingActorId('execution_retirada'), null);
  } finally { await fixtures.dispose(p.executionId); await db.$disconnect(); }
});
