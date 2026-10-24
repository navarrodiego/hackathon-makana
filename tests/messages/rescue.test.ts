import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS } from '../../src/lib/contracts/core';
import { outputOf, world, type Classify } from './helpers';

const ready = () => new Promise<void>(resolve => setTimeout(resolve, 25));
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const good: Classify = (t) => ({ ok: true, fence: null as never, provenance: null as never, output: t.startsWith('SEGUNDO') ? outputOf({ evidence: { location: 'local 9', resource: 'caja 5', problem: 'sin red' } }) : outputOf() });

// Un reporte sin clasificación guardada (la función murió o la base no respondió) no debe trabar la cola.
test('un reporte trabado pasa a degradado tras el plazo y libera a los siguientes, en orden', async () => {
  const gate = deferred<void>();
  const w = await world(undefined, async text => { if (text.startsWith('PRIMERO')) await gate.promise; return good(text); });
  try {
    const first = w.service.submit(w.reporter(), w.input('PRIMERO Local 7 caja 2 no emite boletas', 'r1'));
    while (w.calls.length < 1) await ready();
    const second = await w.service.submit(w.reporter(), w.input('SEGUNDO otro hecho', 'r2'));
    assert.ok(second.ok && second.value.status === 'processing');

    // Antes del plazo no se toca nada.
    const early = await w.service.rescueStalled(w.ctx({ kind: 'system' }, 'system', LIMITS.classificationStallMs - 1_000));
    assert.deepEqual(early, { ok: true, value: 0 });
    assert.ok((await w.snapshot()).reports.every(r => r.status === 'processing'));

    const rescued = await w.service.rescueStalled(w.ctx({ kind: 'system' }, 'system', LIMITS.classificationStallMs + 1_000));
    assert.deepEqual(rescued, { ok: true, value: 1 });
    const s = await w.snapshot();
    assert.ok(s.reports.every(r => r.status === 'completed'));
    assert.equal(s.reports[0].classification?.mode, 'degraded');
    assert.equal(s.reports[0].classification?.mode === 'degraded' && s.reports[0].classification.reason, 'timeout');
    assert.equal(s.reports[0].decision?.route, 'review');
    assert.equal(s.reports[1].classification?.mode, 'model');
    const decided = s.events.filter(e => e.kind === 'policy_decided');
    assert.deepEqual(decided.map(e => e.entity.id), [s.reports[0].id, s.reports[1].id]);

    // La respuesta tardía de la IA no reescribe el degradado: quien envió recibe el recibo guardado.
    gate.resolve();
    const late = await first;
    assert.ok(late.ok, JSON.stringify(late));
    const after = await w.snapshot();
    assert.equal(after.reports[0].classification?.mode, 'degraded');
    assert.equal(after.events.filter(e => e.kind === 'report_classified' && e.entity.id === after.reports[0].id).length, 1);
  } finally { await w.close(); }
});

test('reintento con la misma clave de un reporte trabado vuelve a clasificarlo', async () => {
  const hang = deferred<void>();
  let calls = 0;
  const w = await world(undefined, async text => { calls++; if (calls === 1) await hang.promise; return good(text); });
  try {
    const input = w.input('Local 7 caja 2 no emite boletas', 'k1');
    const lost = w.service.submit(w.reporter(), input);
    while (w.calls.length < 1) await ready();
    // Un reintento inmediato sigue pendiente (la petición original aún puede responder).
    assert.deepEqual(await w.service.submit(w.reporter(1_000), input), { ok: false, code: 'OPERATION_PENDING' });
    assert.equal(w.calls.length, 1);
    // Pasado el máximo de espera de la IA, el reintento clasifica de nuevo y completa.
    const retry = await w.service.submit(w.reporter(LIMITS.classificationTimeoutMaxMs + 1_000), input);
    assert.ok(retry.ok && retry.value.status === 'incident', JSON.stringify(retry));
    assert.equal(w.calls.length, 2);
    assert.equal((await w.snapshot()).execution.admittedReports, 1);
    hang.resolve();
    await lost;
    assert.equal((await w.snapshot()).incidents.length, 1);
  } finally { await w.close(); }
});
