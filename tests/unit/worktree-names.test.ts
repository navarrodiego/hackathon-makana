import assert from 'node:assert/strict';
import { test } from 'node:test';
import { worktreeDatabases } from '../../scripts/db/worktree-names';
import { localDestination } from '../../scripts/db/destination';

test('nombres de base por worktree: estables, distintos por ruta y aceptados por la guarda', () => {
  const a = worktreeDatabases('/work/.claude/worktrees/t06-tasks-implementation-ebc32e');
  assert.deepEqual(a, worktreeDatabases('/work/.claude/worktrees/t06-tasks-implementation-ebc32e'));
  assert.notEqual(a.dev, worktreeDatabases('/other/.claude/worktrees/t06-tasks-implementation-ebc32e').dev);
  assert.match(a.dev, /^relevo_wt_t06_tasks_implementatio_[0-9a-f]{6}$/);
  assert.equal(a.test, `${a.dev}_test`); assert.equal(a.isolation, `${a.dev}_test_isolation`);
  for (const n of [a.dev, a.test, a.isolation]) assert.ok(n.length <= 63 - '_app'.length);
  localDestination(`postgresql://x@127.0.0.1/${a.dev}`); localDestination(`postgresql://x@127.0.0.1/${a.isolation}`, true);
});
test('un directorio con caracteres raros o muy largo sigue dando un nombre válido', () => {
  const n = worktreeDatabases('/w/Ñandú; DROP DATABASE x-' + 'z'.repeat(80));
  localDestination(`postgresql://x@127.0.0.1/${n.dev}`);
  assert.match(n.dev, /^relevo_wt_[a-z0-9_]+_[0-9a-f]{6}$/);
  assert.ok(n.isolation.length + '_migrate'.length <= 63);
});
