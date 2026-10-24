import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INCIDENT_FIXTURE } from '../../src/lib/contracts/fixtures';
import type { Instant } from '../../src/lib/contracts/core';
import { persistenceDirectory } from '../../src/lib/server/auth/persistence';
import { createPublicSessionService } from '../../src/lib/server/messages/session';
import { holdLock, within } from '../helpers/db/lock';
import { at, world } from './helpers';

// Una consulta sin nada vencido no debe hacer fila detrás de una escritura que tiene el candado global.
test('consultas sin nada que escribir no esperan el candado global', async t => {
  await t.test('evaluar el estado sin plazos vencidos', async () => {
    const w = await world(INCIDENT_FIXTURE);
    try {
      assert.ok((await w.execution.evaluate(w.system())).ok);
      const lock = holdLock(w.db);
      try {
        await lock.acquired;
        const state = await within(2_000, w.execution.evaluate(w.system()));
        assert.ok(state !== 'timeout' && state.ok, 'el estado esperó el candado');
        assert.equal(state.value.incidents[0].status, 'awaiting_ack');
      } finally { await lock.release(); }
    } finally { await w.close(); }
  });
  await t.test('un plazo vencido igual se aplica una sola vez, con el candado', async () => {
    const w = await world(INCIDENT_FIXTURE);
    try {
      const base = INCIDENT_FIXTURE.operationalAt;
      assert.ok((await w.execution.evaluate(w.system(base))).ok);
      w.setNow(at(base, 31_000));
      const [a, b] = await Promise.all([w.execution.evaluate(w.system()), w.execution.evaluate(w.system())]);
      assert.ok(a.ok && b.ok);
      assert.equal(a.value.incidents[0].candidate?.displayName, 'Tomás');
      assert.equal(b.value.incidents[0].candidate?.displayName, 'Tomás');
      const escalated = (await w.readTx(async tx => ({ ok: true, value: await tx.events.list() }))).filter(e => e.kind === 'incident_escalated');
      assert.equal(escalated.length, 1);
    } finally { await w.close(); }
  });
  await t.test('vista de control y autorización', async () => {
    const w = await world(INCIDENT_FIXTURE);
    try {
      const lock = holdLock(w.db);
      try {
        await lock.acquired;
        const view = await within(2_000, w.read.control(w.control()));
        assert.ok(view !== 'timeout' && view.ok, 'la vista esperó el candado');
        const exists = await within(2_000, persistenceDirectory(w.store).actorExists(w.prepared.executionId, w.ids.Paula));
        assert.equal(exists, true);
      } finally { await lock.release(); }
    } finally { await w.close(); }
  });
  await t.test('entrar al canal crea la sesión', async () => {
    const w = await world(INCIDENT_FIXTURE);
    try {
      const sessions = createPublicSessionService({ store: w.store });
      const lock = holdLock(w.db);
      try {
        await lock.acquired;
        const entered = await within(2_000, sessions.enter(null, new Date().toISOString() as Instant));
        assert.ok(entered !== 'timeout' && entered.ok, 'la entrada esperó el candado');
        assert.ok(entered.value.newOpaqueCookie);
      } finally { await lock.release(); }
    } finally { await w.close(); }
  });
});
