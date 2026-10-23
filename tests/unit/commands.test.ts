import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('migración rechaza DIRECT_URL remota aunque DATABASE_URL sea local y no publica credenciales', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/db/migrate.ts'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://app:fixture-secret@127.0.0.1:5432/relevo_backend', DIRECT_URL: 'postgresql://owner:fixture-secret@ep-demo.neon.tech/relevo_backend' } });
  assert.equal(result.status, 1); assert.match(result.stderr, /Migración local rechazada/); assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret/);
});
test('seed rechaza la base de integración antes de modificar datos', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/db/seed.ts'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://app:fixture-secret@127.0.0.1:5432/relevo_integracion', DIRECT_URL: '' } });
  assert.equal(result.status, 1); assert.match(result.stderr, /Seed local rechazado/); assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret/);
});
