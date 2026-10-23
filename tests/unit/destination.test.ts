import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localDestination } from '../../scripts/db/destination';

test('permite solo las bases locales asignadas, sin parámetros que redirijan conexión', () => {
  assert.equal(localDestination('postgresql://app:private@127.0.0.1:5432/relevo_backend_test').database, 'relevo_backend_test');
  for (const url of [undefined, 'bad', 'postgresql://x@ep-demo.neon.tech/relevo_backend_test',
    'postgresql://x@127.0.0.1/relevo_integracion', 'postgresql://x@localhost/postgres',
    'postgresql://x@localhost/relevo_backend_test?host=remote',
    'postgresql://x@localhost/relevo_backend_test?options=-csearch_path=other',
    'postgresql://x@127.0.0.2/relevo_backend_test']) {
    assert.throws(() => localDestination(url), /Destino local no permitido/);
  }
});
test('limpieza de pruebas rechaza también la base backend de desarrollo', () => {
  assert.throws(() => localDestination('postgresql://x@localhost/relevo_backend', true));
  assert.equal(localDestination('postgresql://x@[::1]/relevo_backend_test_isolation', true).database, 'relevo_backend_test_isolation');
});

test('preparación administrativa acepta solo postgres local y conserva las barreras de red', async () => {
  const { localAdminDestination } = await import('../../scripts/db/destination');
  assert.equal(localAdminDestination('postgresql://owner@127.0.0.1:5432/postgres'), 'postgresql://owner@127.0.0.1:5432/postgres');
  for (const url of ['postgresql://owner@neon.tech/postgres', 'postgresql://owner@localhost/relevo_integracion', 'postgresql://owner@localhost/postgres?host=remote']) assert.throws(() => localAdminDestination(url));
});

test('bases propias de un worktree se admiten por patrón cerrado; las de prueba siguen separadas del desarrollo', () => {
  const base = 'relevo_wt_t06_relevo_ab12cd';
  assert.equal(localDestination(`postgresql://x@127.0.0.1/${base}`).database, base);
  assert.equal(localDestination(`postgresql://x@127.0.0.1/${base}_test`, true).database, `${base}_test`);
  assert.equal(localDestination(`postgresql://x@127.0.0.1/${base}_test_isolation`, true).database, `${base}_test_isolation`);
  assert.throws(() => localDestination(`postgresql://x@127.0.0.1/${base}`, true), /Destino local no permitido/);
  for (const name of ['relevo_wt_', 'relevo_wt_UPPER', 'relevo_wt_a-b', 'relevo_wt_a;drop', `relevo_wt_${'a'.repeat(60)}`, 'relevo_wt_x/../postgres']) {
    assert.throws(() => localDestination(`postgresql://x@127.0.0.1/${name}`), /Destino local no permitido/);
  }
});
