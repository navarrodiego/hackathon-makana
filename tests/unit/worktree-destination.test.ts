import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { localDestination } from '../../scripts/db/destination';

const dev = 'relevo_wt_t06_tasks_implementatio_c0a423';

test('acepta la base de un worktree y exige sufijo de prueba en la limpieza', () => {
  assert.equal(localDestination(`postgresql://x@127.0.0.1:5432/${dev}`).database, dev);
  assert.equal(localDestination(`postgresql://x@127.0.0.1:5432/${dev}_test`, true).database, `${dev}_test`);
  assert.equal(localDestination(`postgresql://x@localhost/${dev}_test_isolation`, true).database, `${dev}_test_isolation`);
  assert.throws(() => localDestination(`postgresql://x@127.0.0.1:5432/${dev}`, true), /Destino local no permitido/);
});

test('rechaza nombres que no siguen la convención de worktree', () => {
  for (const name of ['relevo_wt_', 'relevo_wt_abc', 'relevo_wt_x_c0a42', 'relevo_wt_x_C0A423', 'relevo_wt_x_c0a423_other',
    'relevo_wt_x_c0a423_test_extra', 'relevo_integracion', 'postgres', 'otro_wt_x_c0a423']) {
    assert.throws(() => localDestination(`postgresql://x@127.0.0.1:5432/${name}`), /Destino local no permitido/, name);
  }
  assert.throws(() => localDestination(`postgresql://x@ep-demo.neon.tech/${dev}`), /Destino local no permitido/);
  assert.throws(() => localDestination(`postgresql://x@127.0.0.1:5433/${dev}`), /Destino local no permitido/);
  assert.throws(() => localDestination(`postgresql://x@127.0.0.1/${dev}?host=remote`), /Destino local no permitido/);
});

function lib(script: string, ...args: string[]) {
  return spawnSync('bash', ['-c', `source scripts/worktree/lib.sh; ${script}`, 'bash', ...args], { encoding: 'utf8' });
}

test('el nombre de base es estable, único por ruta y válido para la convención', () => {
  const a = lib('wt_base_name "$1"', '/a/.claude/worktrees/t10-Tareas Nuevas').stdout.trim();
  const again = lib('wt_base_name "$1"', '/a/.claude/worktrees/t10-Tareas Nuevas').stdout.trim();
  const other = lib('wt_base_name "$1"', '/b/.claude/worktrees/t10-Tareas Nuevas').stdout.trim();
  assert.equal(a, again);
  assert.notEqual(a, other);
  assert.match(a, /^relevo_wt_t10_tareas_nuevas_[0-9a-f]{6}$/);
  const long = lib('wt_base_name "$1"', `/x/${'larguisimo-'.repeat(12)}`).stdout.trim();
  assert.match(long, /^relevo_wt_[a-z0-9_]{1,40}_[0-9a-f]{6}$/);
  assert.ok(`${long}_test_isolation_migrate`.length <= 63);
});

test('la comprobación de nombres rechaza bases ajenas al flujo de worktrees', () => {
  for (const name of ['relevo_backend', 'relevo_integracion', 'postgres', 'relevo_wt_x', `${dev}; DROP`]) {
    assert.notEqual(lib('wt_valid_db "$1"', name).status, 0, name);
  }
  for (const name of [dev, `${dev}_test`, `${dev}_test_isolation`]) assert.equal(lib('wt_valid_db "$1"', name).status, 0, name);
});

test('el destino administrativo debe ser PostgreSQL local en el puerto 5432', () => {
  for (const url of ['postgresql://u@ep-demo.neon.tech/postgres', 'postgresql://u@127.0.0.1:5433/postgres', 'postgresql://u@127.0.0.1/otra',
    'postgresql://u@127.0.0.1/postgres?host=remote']) {
    assert.notEqual(lib('wt_check_admin "$1"', url).status, 0, url);
  }
  assert.equal(lib('wt_check_admin "$1"', 'postgresql://u@127.0.0.1:5432/postgres').status, 0);
  assert.equal(lib('wt_check_admin "$1"', 'postgresql://u@localhost/postgres').status, 0);
});
