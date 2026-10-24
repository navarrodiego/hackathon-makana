import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequestValidator } from '../../src/lib/server/http/validate';

const v = createRequestValidator();
const base = { executionId: 'execution_a1', idempotencyKey: 'key-1.ok_2' };
const versioned = { ...base, expectedVersion: 3 };
const tickets = ['481', '470', '462'].map(n => ({ ticketId: `ticket_${n}`, disposition: 'puede_esperar', reason: 'Motivo breve.' }));
const bad = (route: Parameters<typeof v.parse>[0], body: unknown, params: unknown = null) =>
  assert.deepEqual(v.parse(route, { body, params }), { ok: false, code: 'INVALID_INPUT' }, JSON.stringify(body));

test('mutación común: ejecución, clave idempotente y campos desconocidos', () => {
  const ok = v.parse('POST /api/scene', { body: { ...versioned, sceneId: 'scene_channel', channelOpen: true }, params: null });
  assert.equal(ok.ok, true);
  bad('POST /api/scene', { ...versioned, sceneId: 'scene_channel' });
  bad('POST /api/scene', { ...versioned, sceneId: 'scene_channel', channelOpen: true, extra: 1 });
  bad('POST /api/scene', { ...versioned, executionId: 'handoff_x', sceneId: 'scene_channel', channelOpen: true });
  bad('POST /api/scene', { ...versioned, idempotencyKey: '', sceneId: 'scene_channel', channelOpen: true });
  bad('POST /api/scene', { ...versioned, idempotencyKey: 'a'.repeat(129), sceneId: 'scene_channel', channelOpen: true });
  bad('POST /api/scene', { ...versioned, idempotencyKey: 'con espacio', sceneId: 'scene_channel', channelOpen: true });
  for (const action of ['extend', 'show']) assert.equal(v.parse('POST /api/qr', { body: { ...versioned, action }, params: null }).ok, true);
  bad('POST /api/qr', versioned);
  bad('POST /api/qr', { ...versioned, action: 'hide' });
  bad('POST /api/qr', { ...versioned, action: 'extend', seconds: 60 });
  for (const expectedVersion of [0, -1, 1.5, '3', null]) bad('POST /api/reset', { ...base, expectedVersion });
  bad('POST /api/reset', null); bad('POST /api/reset', []); bad('POST /api/reset', 'x');
});

test('identificadores: prefijo de entidad y alfabeto acotado', () => {
  for (const id of ['execution_', 'execution_a b', 'execution_<script>', 'x'.repeat(100), `execution_${'a'.repeat(80)}`]) {
    bad('POST /api/reset', { ...versioned, executionId: id });
  }
});

test('reporte: recorta, cuenta puntos de código y rechaza control, vacío y apodo largo', () => {
  const good = v.parse('POST /api/messages', { body: { ...base, nickname: '  Local 12 ', text: '  No emite boletas.\nOtra línea\tcon tab  ' }, params: null });
  assert.deepEqual(good.ok && good.value.input, { ...base, nickname: 'Local 12', text: 'No emite boletas.\nOtra línea\tcon tab' });
  assert.equal(v.parse('POST /api/messages', { body: { ...base, nickname: 'a', text: '😀'.repeat(280) }, params: null }).ok, true);
  bad('POST /api/messages', { ...base, nickname: 'a', text: '😀'.repeat(281) });
  bad('POST /api/messages', { ...base, nickname: 'a', text: '   ' });
  bad('POST /api/messages', { ...base, nickname: '  ', text: 'x' });
  bad('POST /api/messages', { ...base, nickname: 'n'.repeat(41), text: 'x' });
  bad('POST /api/messages', { ...base, nickname: 'a', text: 'hola\u0000mundo' });
  bad('POST /api/messages', { ...base, nickname: 'a', text: 'hola‮mundo' });
  assert.equal(v.parse('POST /api/messages', { body: { ...base, nickname: '<b>x</b>', text: '<img src=x onerror=1>' }, params: null }).ok, true, 'el HTML se conserva como texto; se escapa al mostrar');
});

test('enviar relevo: una decisión única por pendiente del escenario, razón y nota de hasta 60 palabras', () => {
  const body = { ...versioned, handoffId: 'handoff_1', note: 'Nota breve.', tickets };
  assert.equal(v.parse('POST /api/handoff', { body, params: null }).ok, true);
  assert.equal(v.parse('POST /api/handoff', { body: { ...body, note: Array(60).fill('a').join(' ') }, params: null }).ok, true);
  bad('POST /api/handoff', { ...body, note: Array(61).fill('a').join(' ') });
  bad('POST /api/handoff', { ...body, tickets: tickets.slice(0, 2) });
  bad('POST /api/handoff', { ...body, tickets: [...tickets.slice(0, 2), tickets[0]] });
  bad('POST /api/handoff', { ...body, tickets: [...tickets.slice(0, 2), { ...tickets[2], disposition: 'urgente' }] });
  bad('POST /api/handoff', { ...body, tickets: [...tickets.slice(0, 2), { ...tickets[2], reason: '  ' }] });
  bad('POST /api/handoff', { ...body, tickets: [...tickets.slice(0, 2), { ...tickets[2], extra: true }] });
  bad('POST /api/handoff', { ...body, handoffId: 'ticket_1' });
});

test('actor representado: opcional, con formato de actor', () => {
  const body = { ...versioned, handoffId: 'handoff_1' };
  assert.equal(v.parse('POST /api/handoff/suggest', { body: { ...body, representedActorId: 'actor_outgoing' }, params: null }).ok, true);
  bad('POST /api/handoff/suggest', { ...body, representedActorId: 'incident_1' });
});

test('rutas con [id]: el parámetro debe tener la entidad correcta', () => {
  const body = { ...versioned, attemptId: 'handoff_attempt_1' };
  assert.equal(v.parse('POST /api/handoff/[id]/accept', { body, params: { id: 'handoff_1' } }).ok, true);
  bad('POST /api/handoff/[id]/accept', body, { id: 'incident_1' });
  bad('POST /api/handoff/[id]/accept', body, null);
  bad('POST /api/handoff/[id]/reject', { ...body, attemptId: 'incident_attempt_1' }, { id: 'handoff_1' });
  assert.equal(v.parse('POST /api/ack/[id]', { body: { ...versioned, attemptId: 'incident_attempt_1' }, params: { id: 'incident_1' } }).ok, true);
  bad('POST /api/ack/[id]', { ...versioned, attemptId: 'handoff_attempt_1' }, { id: 'incident_1' });
});

test('GET state no lleva cuerpo ni parámetros', () => {
  assert.equal(v.parse('GET /api/state', { body: null, params: null }).ok, true);
  bad('GET /api/state', { a: 1 });
});
