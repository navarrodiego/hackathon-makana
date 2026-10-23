import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { outputOf, world, OPEN_FIXTURE } from './helpers';

test('canal cerrado: rechaza sin consumir cuota ni crear reporte (A08)', async () => {
  const w = await world({ ...BASE_FIXTURE, channelOpen: false });
  try {
    const r = await w.service.submit(w.reporter(), w.input('No funciona la caja'));
    assert.deepEqual(r, { ok: false, code: 'CHANNEL_CLOSED' });
    const s = await w.snapshot();
    assert.equal(s.reports.length, 0);
    assert.equal(s.execution.admittedReports, 0);
    assert.equal(w.calls.length, 0);
  } finally { await w.close(); }
});

test('crítico alto: recibo de incidente, reporte completado y aviso al titular', async () => {
  const w = await world();
  try {
    const r = await w.service.submit(w.reporter(), w.input('Local 7 caja 2 no emite boletas'));
    assert.ok(r.ok);
    assert.equal(r.value.status, 'incident');
    assert.equal(r.value.classificationMode, 'model');
    assert.equal(r.value.duplicate, false);
    assert.ok(r.value.incidentId);
    const s = await w.snapshot();
    assert.equal(s.reports.length, 1);
    assert.equal(s.reports[0].status, 'completed');
    assert.equal(s.reports[0].incidentId, r.value.incidentId);
    assert.equal(s.incidents.length, 1);
    assert.equal(s.notifications.filter(n => n.subject.kind === 'incident').length, 1);
    assert.equal(s.execution.admittedReports, 1);
  } finally { await w.close(); }
});

test('diferible: cola con recibo, sin incidente ni aviso (A02)', async () => {
  const w = await world(OPEN_FIXTURE, () => ({ ok: true, fence: null as never, provenance: null as never, output: outputOf({ service: 'cuentas', pc: 0.1, scope: 'persona', evidence: { location: null, resource: null, problem: 'cuenta nueva' } }) }));
  try {
    const r = await w.service.submit(w.reporter(), w.input('Necesito una cuenta nueva'));
    assert.ok(r.ok);
    assert.equal(r.value.status, 'queued');
    assert.equal(r.value.incidentId, null);
    const s = await w.snapshot();
    assert.equal(s.incidents.length, 0);
    assert.equal(s.notifications.length, 0);
    assert.equal(s.reports[0].decision?.route, 'queue');
  } finally { await w.close(); }
});

test('proveedor falla: modo degradado rotulado y revisión conservadora, no diferido (A05)', async () => {
  const w = await world(OPEN_FIXTURE, () => ({ ok: false, fence: null as never, reason: 'timeout' }));
  try {
    const r = await w.service.submit(w.reporter(), w.input('Algo raro con el sistema'));
    assert.ok(r.ok);
    assert.equal(r.value.classificationMode, 'degraded');
    const s = await w.snapshot();
    assert.equal(s.reports[0].decision?.route, 'review');
    assert.equal(s.reports[0].classification?.mode, 'degraded');
    assert.equal(s.incidents.length, 1); // revisión conservadora por la guardia vigente, no diferido
  } finally { await w.close(); }
});

test('misma clave idempotente: devuelve el recibo original sin nueva IA ni cuota', async () => {
  const w = await world();
  try {
    const input = w.input('Local 7 caja 2 no emite boletas', 'clave-1');
    const a = await w.service.submit(w.reporter(), input);
    const b = await w.service.submit(w.reporter(), input);
    assert.ok(a.ok && b.ok);
    assert.deepEqual(b.value, a.value);
    assert.equal(w.calls.length, 1);
    assert.equal((await w.snapshot()).execution.admittedReports, 1);
  } finally { await w.close(); }
});

test('misma clave con otro contenido: conflicto de idempotencia (C14)', async () => {
  const w = await world();
  try {
    await w.service.submit(w.reporter(), w.input('Primer hecho', 'clave-2'));
    const r = await w.service.submit(w.reporter(), w.input('Otro hecho distinto', 'clave-2'));
    assert.deepEqual(r, { ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    assert.equal((await w.snapshot()).reports.length, 1);
  } finally { await w.close(); }
});

test('apodo distinto no cambia la huella del hecho pero sí cuenta cuota (A08)', async () => {
  const w = await world();
  try {
    for (let i = 0; i < 5; i++) {
      const r = await w.service.submit(w.reporter(), w.input(`Hecho ${i}`, `k${i}`, `Apodo ${i}`));
      assert.ok(r.ok, `envío ${i}`);
    }
    const sixth = await w.service.submit(w.reporter(), w.input('Hecho 6', 'k6', 'Otro apodo nuevo'));
    assert.deepEqual(sixth, { ok: false, code: 'QUOTA_EXCEEDED' });
    const s = await w.snapshot();
    assert.equal(s.reports.length, 5);
    assert.equal(s.execution.admittedReports, 5);
  } finally { await w.close(); }
});

test('control usa una sesión de escenario estable con origen escenario y las mismas cuotas', async () => {
  const w = await world();
  try {
    const a = await w.service.submit(w.control(), w.input('Reporte guionado 1', 'c1', 'Guion'));
    const b = await w.service.submit(w.control(), w.input('Reporte guionado 2', 'c2', 'Guion'));
    assert.ok(a.ok && b.ok);
    const s = await w.snapshot();
    assert.equal(s.reports.length, 2);
    assert.equal(s.reports[0].origin, 'scenario');
    assert.equal(s.reports[0].sessionId, s.reports[1].sessionId);
    assert.notEqual(s.reports[0].sessionId, w.prepared.sessionId);
  } finally { await w.close(); }
});

test('principal sin permiso de ingreso (destinatario) se rechaza', async () => {
  const w = await world();
  try {
    const r = await w.service.submit(w.ctx({ kind: 'system' }), w.input('Hecho'));
    assert.deepEqual(r, { ok: false, code: 'FORBIDDEN' });
  } finally { await w.close(); }
});
