import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CommandContext } from '../../src/lib/contracts/auth';
import type { Event, NotificationIntent } from '../../src/lib/contracts/domain';
import type { TransactionRepositories } from '../../src/lib/contracts/repositories';
import { createEventService, recordEvent, registerNotificationIntent, logicalKeyFor } from '../../src/lib/server/events';

const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  executionId: 'execution_now', executionVersion: 4, principal: { kind: 'outgoing', actorId: 'actor_outgoing' }, actorId: 'actor_outgoing',
  origin: 'web', operationalNow: '2026-10-23T15:00:10.500Z', narrativeNow: '2026-10-24T01:10:00.500Z', correlationId: 'correlation_1', ...over,
});
function fakeTx() {
  const events: Event[] = [], intents: NotificationIntent[] = [];
  const tx = {
    events: { append: async (e: Omit<Event, 'id' | 'sequence'>) => { const full = { ...e, id: `event_${events.length + 1}`, sequence: events.length + 1 } as Event; events.push(full); return full; }, list: async () => events },
    aggregates: { notifications: { list: async () => intents, insert: async (i: NotificationIntent) => { intents.push(i); }, get: async () => null, compareAndSwap: async () => true } },
  } as unknown as TransactionRepositories;
  return { tx, events, intents };
}
const base = { kind: 'handoff_sent', entity: { kind: 'handoff', id: 'handoff_1' }, entityVersion: 2, channel: 'web', details: { kind: 'transition', from: 'draft', to: 'awaiting_candidate' }, result: 'recorded' } as const;

test('recordEvent completa actor, principal, origen, relojes y correlación desde el contexto', async () => {
  const { tx, events } = fakeTx();
  const saved = await recordEvent(tx, ctx(), base);
  assert.equal(events.length, 1);
  assert.deepEqual({ ...saved, id: undefined, sequence: undefined }, {
    id: undefined, sequence: undefined, executionId: 'execution_now', kind: 'handoff_sent', entity: base.entity, entityVersion: 2,
    actorId: 'actor_outgoing', principal: { kind: 'actor', actorId: 'actor_outgoing' }, origin: 'web', channel: 'web',
    details: base.details, operationalAt: '2026-10-23T15:00:10.500Z', narrativeAt: '2026-10-24T01:10:00.500Z', correlationId: 'correlation_1', result: 'recorded',
  });
});

test('principal del evento: control conserva al operador y el actor representado; sistema y reportante no inventan actor', async () => {
  const { tx } = fakeTx();
  const control = await recordEvent(tx, ctx({ principal: { kind: 'control', operatorId: 'demo_control' }, actorId: 'actor_incoming', origin: 'scenario' }), base);
  assert.deepEqual(control.principal, { kind: 'control', operatorId: 'demo_control' });
  assert.equal(control.actorId, 'actor_incoming'); assert.equal(control.origin, 'scenario');
  const system = await recordEvent(tx, ctx({ principal: { kind: 'system' }, actorId: null, origin: 'system' }), { ...base, channel: 'system' });
  assert.deepEqual(system.principal, { kind: 'system' }); assert.equal(system.actorId, null);
  const reporter = await recordEvent(tx, ctx({ principal: { kind: 'reporter', sessionId: 'session_a' }, actorId: null }), base);
  assert.deepEqual(reporter.principal, { kind: 'reporter', sessionId: 'session_a' });
  const recipient = await recordEvent(tx, ctx({ principal: { kind: 'recipient', actorId: 'actor_incoming', grant: {} as never }, actorId: 'actor_incoming' }), base);
  assert.deepEqual(recipient.principal, { kind: 'actor', actorId: 'actor_incoming' });
  assert.ok(!JSON.stringify(recipient).includes('grant'));
});

test('recordEvent rechaza campos no permitidos (no se hace spread de entidades ni secretos)', async () => {
  const { tx, events } = fakeTx();
  await assert.rejects(recordEvent(tx, ctx(), { ...base, extra: 'x' } as never), /no permitido/);
  await assert.rejects(recordEvent(tx, ctx(), { ...base, details: { kind: 'record', token: 'abc' } } as never), /no permitido/);
  await assert.rejects(recordEvent(tx, ctx(), { ...base, details: { kind: 'transition', from: 'a', to: 'b', note: 'texto libre' } } as never), /no permitido/);
  await assert.rejects(recordEvent(tx, ctx(), { ...base, entityVersion: 0 }), /versión/);
  assert.equal(events.length, 0);
});

test('EventService.append exige que el evento coincida con el contexto de la operación', async () => {
  const { tx, events } = fakeTx();
  const service = createEventService();
  const good = await recordEvent(fakeTx().tx, ctx(), base);
  const { id: _i, sequence: _s, ...event } = good; void _i; void _s;
  await service.append(tx, ctx(), event);
  assert.equal(events.length, 1);
  for (const bad of [
    { ...event, executionId: 'execution_old' }, { ...event, actorId: 'actor_incoming' }, { ...event, origin: 'scenario' },
    { ...event, correlationId: 'correlation_x' }, { ...event, principal: { kind: 'system' } },
  ] as const) await assert.rejects(service.append(tx, ctx(), bad as never), /contexto/);
  assert.equal(events.length, 1);
});

test('intención de aviso: una por clave lógica, evento de intención y sin tratarla como envío', async () => {
  const { tx, events, intents } = fakeTx();
  const subject = { kind: 'incident', id: 'incident_1', attemptId: 'incident_attempt_1' } as const;
  const first = await registerNotificationIntent(tx, ctx({ principal: { kind: 'system' }, actorId: null, origin: 'system' }), { subject, recipientActorId: 'actor_incoming', channel: 'ntfy' });
  assert.equal(first.created, true);
  assert.equal(first.intent.status, 'pending'); assert.equal(first.intent.version, 1);
  assert.equal(first.intent.logicalKey, logicalKeyFor(subject, 'actor_incoming', 'ntfy'));
  assert.equal(events.length, 1); assert.equal(events[0].kind, 'notification_intended'); assert.equal(events[0].result, 'recorded');
  assert.deepEqual(events[0].entity, { kind: 'notification', id: first.intent.id });
  const again = await registerNotificationIntent(tx, ctx(), { subject, recipientActorId: 'actor_incoming', channel: 'ntfy' });
  assert.equal(again.created, false); assert.equal(again.intent.id, first.intent.id);
  assert.equal(intents.length, 1); assert.equal(events.length, 1);
  const other = await registerNotificationIntent(tx, ctx(), { subject: { ...subject, attemptId: 'incident_attempt_2' }, recipientActorId: 'actor_backup', channel: 'in_app' });
  assert.equal(other.created, true); assert.equal(intents.length, 2);
});

test('la clave lógica distingue sujeto, intento, destinatario y canal', () => {
  const s = { kind: 'handoff', id: 'handoff_1', attemptId: 'handoff_attempt_1' } as const;
  const keys = new Set([
    logicalKeyFor(s, 'actor_a', 'ntfy'), logicalKeyFor(s, 'actor_b', 'ntfy'), logicalKeyFor(s, 'actor_a', 'in_app'),
    logicalKeyFor({ ...s, attemptId: 'handoff_attempt_2' }, 'actor_a', 'ntfy'),
    logicalKeyFor({ kind: 'coordination', entity: { kind: 'incident', id: 'incident_1' } }, 'actor_a', 'in_app'),
  ]);
  assert.equal(keys.size, 5);
});
