import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCRIPTED_REPORTS, RESET_ARM_MS, adjacentScene, buildReportRequest, buildResetRequest, buildSceneRequest,
  buildTakeRequest, isEditableTarget, takeableIncident, resolveShortcut, type ShortcutState,
} from '../../src/components/control/logic';

const scenes = [
  { id: 'scene_closing', label: 'Cierre' }, { id: 'scene_channel', label: 'Canal' },
  { id: 'scene_night', label: 'Registro de noche' }, { id: 'scene_morning', label: 'Registro de mañana' },
] as never;
const idle: ShortcutState = { armedAt: null, resetOpen: false };
const press = (key: string, state: ShortcutState = idle, over: Record<string, unknown> = {}) =>
  resolveShortcut({ key, now: 1000, target: null, repeat: false, ctrl: false, alt: false, meta: false, ...over }, state);

test('las flechas, espacio y letras mapean a las acciones de DEMO', () => {
  assert.equal(press('ArrowRight').action, 'next_scene');
  assert.equal(press(' ').action, 'next_scene');
  assert.equal(press('ArrowLeft').action, 'previous_scene');
  assert.equal(press('o').action, 'toggle_channel');
  assert.equal(press('I').action, 'next_report');
  assert.equal(press('p').action, 'billing_report');
  assert.equal(press('q').action, 'toggle_qr');
  assert.equal(press('m').action, 'mute');
  assert.equal(press('x').action, null);
});

test('no se activan al escribir, con modificadores, repetidas ni con el diálogo de reset abierto', () => {
  assert.equal(press('o', idle, { target: { tagName: 'INPUT' } }).action, null);
  assert.equal(press('o', idle, { target: { tagName: 'TEXTAREA' } }).action, null);
  assert.equal(press('o', idle, { target: { tagName: 'SELECT' } }).action, null);
  assert.equal(press('o', idle, { target: { tagName: 'DIV', isContentEditable: true } }).action, null);
  assert.equal(press('o', idle, { meta: true }).action, null);
  assert.equal(press('o', idle, { ctrl: true }).action, null);
  assert.equal(press('o', idle, { repeat: true }).action, null);
  assert.equal(press('o', { armedAt: null, resetOpen: true }).action, null);
  assert.equal(isEditableTarget({ tagName: 'BUTTON' }), false);
});

test('RR: la primera R arma, la segunda abre la confirmación y no ejecuta el reset', () => {
  const first = press('r');
  assert.equal(first.action, 'reset_arm');
  assert.equal(first.state.armedAt, 1000);
  const second = press('R', first.state, { now: 1000 + RESET_ARM_MS - 1 });
  assert.equal(second.action, 'reset_open');
  assert.equal(second.state.resetOpen, true);
  assert.equal(second.state.armedAt, null);
});

test('RR: pasado el plazo la segunda R solo vuelve a armar; otra tecla desarma', () => {
  const first = press('r');
  assert.equal(press('r', first.state, { now: 1000 + RESET_ARM_MS + 1 }).action, 'reset_arm');
  const other = press('o', first.state);
  assert.equal(other.action, 'toggle_channel');
  assert.equal(other.state.armedAt, null);
});

test('escena adyacente se queda en los extremos', () => {
  assert.equal(adjacentScene(scenes, 'scene_closing', -1), null);
  assert.equal(adjacentScene(scenes, 'scene_closing', 1)?.id, 'scene_channel');
  assert.equal(adjacentScene(scenes, 'scene_morning', 1), null);
  assert.equal(adjacentScene(scenes, 'desconocida', 1), null);
});

test('escena y reset usan la versión de la ejecución y la clave recibida', () => {
  assert.deepEqual(buildSceneRequest({ executionId: 'e1', version: 7 } as never, 'scene_night', true, 'k1'),
    { executionId: 'e1', idempotencyKey: 'k1', expectedVersion: 7, sceneId: 'scene_night', channelOpen: true });
  assert.deepEqual(buildResetRequest({ executionId: 'e1', version: 7 } as never, 'k2'),
    { executionId: 'e1', idempotencyKey: 'k2', expectedVersion: 7 });
});

test('reporte guionado usa el apodo de escenario y el texto fijo, sin permisos nuevos', () => {
  assert.equal(SCRIPTED_REPORTS.length, 4);
  const body = buildReportRequest('execution_1' as never, SCRIPTED_REPORTS[0], 'k3');
  assert.equal(body.executionId, 'execution_1'); assert.equal(body.idempotencyKey, 'k3');
  assert.ok(body.text.length <= 280 && body.nickname.length <= 40);
  assert.equal('representedActorId' in body, false);
});

const incident = (over: Record<string, unknown> = {}) => ({
  id: 'incident_1', version: 4, status: 'awaiting_ack', attemptId: 'iatt_1',
  candidate: { id: 'actor_tomas', displayName: 'Tomás' }, deadlineAt: '2026-10-24T01:10:30.000Z', takenBy: null, takenAt: null, ...over,
}) as never;

test('Tomás solo puede tomar un incidente cuyo candidato vigente es él y sigue abierto', () => {
  assert.equal(takeableIncident([incident()], 'actor_tomas')?.id, 'incident_1');
  assert.equal(takeableIncident([incident({ candidate: { id: 'actor_paula', displayName: 'Paula' } })], 'actor_tomas'), null);
  assert.equal(takeableIncident([incident({ status: 'taken' })], 'actor_tomas'), null);
  assert.equal(takeableIncident([incident({ attemptId: null })], 'actor_tomas'), null);
});

test('tomar incidente envía versión, intento y actor representado del incidente', () => {
  const r = buildTakeRequest('execution_1' as never, incident(), 'k4');
  assert.equal(r.url, '/api/ack/incident_1');
  assert.deepEqual(r.body, { executionId: 'execution_1', idempotencyKey: 'k4', expectedVersion: 4, attemptId: 'iatt_1', representedActorId: 'actor_tomas' });
});
