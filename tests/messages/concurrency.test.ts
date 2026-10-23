import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outputOf, world, type Classify } from './helpers';

const ready = () => new Promise<void>(resolve => setTimeout(resolve, 25));
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const good: Classify = (t) => ({ ok: true, fence: null as never, provenance: null as never, output: t.startsWith('SEGUNDO') ? outputOf({ evidence: { location: 'local 9', resource: 'caja 5', problem: 'sin red' } }) : outputOf() });

test('20 envíos concurrentes de una sesión: exactamente 5 admitidos (A08)', async () => {
  const w = await world();
  try {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => w.service.submit(w.reporter(), w.input(`Hecho distinto número ${i}`, `c${i}`))));
    assert.equal(results.filter(r => r.ok).length, 5);
    assert.equal(results.filter(r => !r.ok && r.code === 'QUOTA_EXCEEDED').length, 15);
    const s = await w.snapshot();
    assert.equal(s.reports.length, 5);
    assert.equal(s.execution.admittedReports, 5);
    assert.ok(s.reports.every(r => r.status === 'completed'));
    assert.deepEqual(s.reports.map(r => r.admissionSequence), [1, 2, 3, 4, 5]);
  } finally { await w.close(); }
});

test('reportes equivalentes simultáneos: un incidente y un aviso lógico, todos vinculados (I04)', async () => {
  const w = await world();
  try {
    const sessions = [w.prepared.sessionId];
    const results = await Promise.all(['Local 7 caja 2 no emite boletas', 'Local 7 caja 2 no emite boletas'].map((t, i) => w.service.submit(w.reporter(0, sessions[0]), w.input(t, `e${i}`))));
    assert.ok(results.every(r => r.ok));
    const s = await w.snapshot();
    assert.equal(s.incidents.length, 1);
    assert.equal(s.notifications.filter(n => n.subject.kind === 'incident').length, 1);
    assert.ok(s.reports.every(r => r.incidentId === s.incidents[0].id));
    const dup = results.filter(r => r.ok && r.value.duplicate);
    assert.equal(dup.length, 1);
  } finally { await w.close(); }
});

test('respuesta de IA fuera de orden: no salta al reporte anterior y ambos terminan en orden (C13)', async () => {
  const gate = deferred<void>();
  const w = await world(undefined, async text => { if (text.startsWith('PRIMERO')) await gate.promise; return good(text); });
  try {
    const first = w.service.submit(w.reporter(), w.input('PRIMERO Local 7 caja 2 no emite boletas', 'f1'));
    while (w.calls.length < 1) await ready();
    const second = await w.service.submit(w.reporter(), w.input('SEGUNDO otro hecho', 'f2'));
    // El segundo ya está clasificado, pero el primero no: no se decide ni se completa.
    assert.ok(second.ok);
    assert.equal(second.value.status, 'processing');
    assert.equal((await w.snapshot()).incidents.length, 0);
    gate.resolve();
    const r1 = await first;
    assert.ok(r1.ok && r1.value.status === 'incident');
    const s = await w.snapshot();
    assert.ok(s.reports.every(r => r.status === 'completed'));
    const created = s.events.filter(e => e.kind === 'incident_created');
    assert.equal(created.length, 2);
    assert.ok(created[0].sequence < created[1].sequence);
    assert.equal(s.incidents.find(i => i.firstReportId === s.reports[0].id)?.id, created[0].entity.id);
    // El reintento del segundo con su misma clave devuelve el recibo final, sin nueva IA.
    const calls = w.calls.length;
    const retry = await w.service.submit(w.reporter(), w.input('SEGUNDO otro hecho', 'f2'));
    assert.ok(retry.ok && retry.value.status === 'incident');
    assert.equal(w.calls.length, calls);
  } finally { await w.close(); }
});

test('reintento mientras el primero sigue sin clasificar: operación pendiente, sin repetir IA ni cuota', async () => {
  const gate = deferred<void>();
  const w = await world(undefined, async text => { await gate.promise; return good(text); });
  try {
    const input = w.input('Local 7 caja 2 no emite boletas', 'p1');
    const first = w.service.submit(w.reporter(), input);
    while (w.calls.length < 1) await ready();
    const again = await w.service.submit(w.reporter(), input);
    assert.deepEqual(again, { ok: false, code: 'OPERATION_PENDING' });
    assert.equal(w.calls.length, 1);
    gate.resolve();
    const r = await first;
    assert.ok(r.ok);
    assert.equal((await w.snapshot()).execution.admittedReports, 1);
  } finally { await w.close(); }
});

test('reporte en la ventana de 10 minutos: une; pasados 10 minutos: crea otro incidente (I04)', async () => {
  const w = await world();
  try {
    const same = 'Local 7 caja 2 no emite boletas';
    await w.service.submit(w.reporter(0), w.input(same, 'w1'));
    const joined = await w.service.submit(w.reporter(599_999), w.input(same, 'w2'));
    const apart = await w.service.submit(w.reporter(600_000), w.input(same, 'w3'));
    assert.ok(joined.ok && joined.value.duplicate);
    assert.ok(apart.ok && !apart.value.duplicate);
    assert.equal((await w.snapshot()).incidents.length, 2);
  } finally { await w.close(); }
});

test('reset durante la clasificación: el resultado tardío se descarta y la nueva ejecución queda limpia (S04)', async () => {
  const gate = deferred<void>();
  const w = await world(undefined, async text => { await gate.promise; return good(text); });
  let successorId: string | null = null;
  try {
    const pending = w.service.submit(w.reporter(), w.input('Local 7 caja 2 no emite boletas', 'r1'));
    while (w.calls.length < 1) await ready();
    const before = await w.snapshot();
    const replaced = await w.store.run(w.ctx({ kind: 'system' }, 'system'), async tx => {
      const current = before.execution;
      const next = { ...current, executionId: `execution_${crypto.randomUUID()}` as never, version: 1, admittedReports: 0, channelOpen: false, supersededBy: null };
      successorId = next.executionId;
      return { ok: true as const, value: Boolean(await tx.replaceExecution(next, current.version)) };
    });
    assert.ok(replaced.ok && replaced.value);
    gate.resolve();
    const result = await pending;
    assert.deepEqual(result, { ok: false, code: 'EXECUTION_STALE' });
    const fresh = await w.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM reports WHERE "executionId"=${successorId}`;
    assert.equal(fresh[0].n, 0);
    const incidents = await w.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM incidents WHERE "executionId"=${successorId}`;
    assert.equal(incidents[0].n, 0);
  } finally {
    // Primero la retirada (referencia a su sucesora), después la sucesora que creó esta prueba.
    const db = w.db;
    await w.dispose();
    if (successorId) await db.$executeRaw`DELETE FROM executions WHERE "executionId"=${successorId}`;
    await db.$disconnect();
  }
});
