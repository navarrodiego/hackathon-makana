import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRespondRequest, failureView, reviewState, formatClock } from '../../src/components/receptor/logic';

const pkg = (over: Record<string, unknown> = {}) => ({
  audience: 'recipient', executionId: 'execution_1',
  handoff: { id: 'handoff_1', version: 3, status: 'awaiting_candidate', attemptId: 'hatt_1', candidate: { id: 'actor_paula', displayName: 'Paula' },
    deadlineAt: '2026-10-23T22:10:30.000Z', acceptedAt: null, effectiveAt: '2026-10-24T01:10:00.000Z', ...over },
  outgoing: { id: 'actor_rodrigo', displayName: 'Rodrigo' }, tickets: [], note: 'Nota',
  coverage: { windowId: 'w', startsAt: '2026-10-24T01:10:00.000Z', endsAt: '2026-10-24T11:00:00.000Z', outgoingEndsAt: '2026-10-24T01:10:00.000Z', status: 'unconfirmed', actor: null },
}) as never;

test('POST de aceptar usa Bearer, JSON, versión e intento vigentes; el token no va en la URL', () => {
  const r = buildRespondRequest('accept', pkg(), 'tok_secret');
  assert.equal(r.url, '/api/handoff/handoff_1/accept');
  assert.equal(r.init.method, 'POST');
  const h = r.init.headers as Record<string, string>;
  assert.equal(h.authorization, 'Bearer tok_secret'); assert.equal(h['content-type'], 'application/json');
  assert.doesNotMatch(r.url, /tok_secret/);
  assert.deepEqual(JSON.parse(r.init.body as string), { executionId: 'execution_1', attemptId: 'hatt_1', expectedVersion: 3, idempotencyKey: r.key });
  assert.equal(r.init.cache, 'no-store'); assert.equal(r.init.referrerPolicy, 'no-referrer');
});

test('rechazar usa la ruta reject y otra clave; la clave es estable por acción e intento y válida', () => {
  const a = buildRespondRequest('accept', pkg(), 't'), a2 = buildRespondRequest('accept', pkg(), 't'), b = buildRespondRequest('reject', pkg(), 't');
  assert.equal(b.url, '/api/handoff/handoff_1/reject');
  assert.equal(a.key, a2.key); assert.notEqual(a.key, b.key);
  assert.match(a.key, /^[A-Za-z0-9._-]{1,128}$/);
});

test('sin intento vigente no se construye una acción', () => {
  assert.throws(() => buildRespondRequest('accept', pkg({ attemptId: null }), 't'));
});

test('estado de revisión: pendiente, aceptado programado, aceptado activo', () => {
  assert.equal(reviewState(pkg()), 'awaiting');
  const sched = pkg({ status: 'accepted', acceptedAt: '2026-10-23T22:00:00.000Z' }) as { coverage: object };
  assert.equal(reviewState({ ...sched, coverage: { ...sched.coverage, status: 'scheduled' } } as never), 'scheduled');
  assert.equal(reviewState({ ...sched, coverage: { ...sched.coverage, status: 'active' } } as never), 'active');
});

test('fallos de lectura y acción: ya derivado nunca se presenta como éxito ni reasigna', () => {
  assert.equal(failureView('CANDIDATE_STALE').kind, 'reassigned');
  assert.equal(failureView('ACTION_EXPIRED').kind, 'reassigned');
  assert.equal(failureView('AUTH_INVALID').kind, 'link_invalid');
  assert.equal(failureView('AUTH_REQUIRED').kind, 'link_invalid');
  assert.equal(failureView('AUTH_EXPIRED').kind, 'link_expired');
  assert.equal(failureView('NOT_FOUND').kind, 'link_invalid');
  assert.equal(failureView('STORAGE_UNAVAILABLE').kind, 'unavailable');
  assert.equal(failureView('VERSION_CONFLICT').kind, 'stale_view');
  for (const c of ['CANDIDATE_STALE', 'AUTH_INVALID', 'STORAGE_UNAVAILABLE'] as const) assert.doesNotMatch(failureView(c).title, /acept|guard|recib/i);
});

test('hora de 24 h en America/Santiago', () => {
  assert.match(formatClock('2026-10-24T01:10:00.000Z'), /^\d{2}:\d{2}$/);
});
