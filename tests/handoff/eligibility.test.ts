import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CoverageWindow } from '../../src/lib/contracts/domain';
import { candidateOrder, nextCandidate } from '../../src/lib/server/handoff/eligibility';

const w = (over: Partial<CoverageWindow> = {}): CoverageWindow => ({
  id: 'window_a', executionId: 'execution_a', startsAt: '2026-10-24T01:10:00.000Z', endsAt: '2026-10-24T11:00:00.000Z',
  outgoingActorId: 'actor_out', outgoingEndsAt: '2026-10-24T01:10:00.000Z',
  incomingActorId: 'actor_in', backupActorIds: ['actor_bk'], coordinatorActorId: 'actor_co', ...over,
});

test('el orden es entrante y luego respaldos de la ventana; saliente y coordinación no entran por rol', () => {
  assert.deepEqual(candidateOrder(w()), ['actor_in', 'actor_bk']);
});
test('un saliente solo es candidato si la ventana lo declara respaldo, sin mirar su nombre', () => {
  assert.deepEqual(candidateOrder(w({ backupActorIds: ['actor_out'] })), ['actor_in', 'actor_out']);
  assert.deepEqual(candidateOrder(w({ outgoingActorId: 'actor_rodrigo' })), ['actor_in', 'actor_bk']);
});
test('la coordinación nunca es candidata aunque esté repetida entre los respaldos', () => {
  assert.deepEqual(candidateOrder(w({ backupActorIds: ['actor_co', 'actor_bk'] })), ['actor_in', 'actor_bk']);
});
test('no se repite un candidato ya intentado ni un duplicado en la lista', () => {
  assert.equal(nextCandidate(w(), ['actor_in']), 'actor_bk');
  assert.equal(nextCandidate(w(), ['actor_in', 'actor_bk']), null);
  assert.deepEqual(candidateOrder(w({ backupActorIds: ['actor_bk', 'actor_bk', 'actor_in'] })), ['actor_in', 'actor_bk']);
});
