import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { localClient } from "../../scripts/db/client";
import { fixturePreparer } from "../helpers/db/fixtures";
import { BASE_FIXTURE } from "../../src/lib/contracts/fixtures";
import type { CommandContext } from "../../src/lib/contracts/auth";
import type { Execution } from "../../src/lib/contracts/domain";
import { PostgresPersistence } from "../../src/lib/server/repositories";
import { createHandoffNoteService } from "../../src/lib/server/handoff-note/service";
import { OUTPUT, okResult, provider } from "./fakes";
import type { NoteOutput } from "../../src/lib/contracts/classification";

// La preparación remapea los IDs de cada ejecución: la salida debe usar los tickets recibidos, como el proveedor real.
const echoTickets = (req: Parameters<Parameters<typeof provider>[0]>[0]) =>
  okResult(req, { ...OUTPUT, suggestions: req.input.tickets.map((t, i): NoteOutput["suggestions"][number] => ({ ticketId: t.id, disposition: i === 2 ? "transferir" : "puede_esperar", reason: "Según la política del ejemplo." })) });
config({ path: ".env.t03", quiet: true });

// Persistencia real: versión, idempotencia y reset. Requiere la base local de pruebas (SETUP §T03).
test("sugerencia de nota sobre PostgreSQL real", async t => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!;
  const db = localClient(url), fixtures = fixturePreparer(db, url), store = new PostgresPersistence(db);
  try {
    await t.test("guarda, reintenta con la misma clave y falla de forma conservadora", async () => {
      const p = await fixtures.prepare(BASE_FIXTURE);
      const c: CommandContext = { executionId: p.executionId, executionVersion: 1, principal: { kind: "outgoing", actorId: p.handoff.outgoingActorId }, actorId: p.handoff.outgoingActorId, origin: "web", operationalNow: BASE_FIXTURE.operationalAt, narrativeNow: BASE_FIXTURE.narrativeAt, correlationId: "correlation_t09_db" };
      const input = { executionId: p.executionId, idempotencyKey: "db-key-1", expectedVersion: p.handoff.version, handoffId: p.handoff.id };
      try {
        const calls = provider(echoTickets);
        const svc = createHandoffNoteService({ unitOfWork: store, provider: calls.impl });
        // Dos peticiones simultáneas con la misma clave: una trabaja y la otra no duplica la llamada.
        const [a, b] = await Promise.all([svc.suggest(c, input), svc.suggest(c, input)]);
        assert.equal(calls.calls.length, 1);
        assert.equal([a, b].some(r => r.ok), true);
        for (const r of [a, b]) assert.ok(r.ok || r.code === "OPERATION_PENDING");
        const again = await svc.suggest(c, input);
        assert.equal(again.ok && again.value.version, p.handoff.version + 1);
        assert.equal(calls.calls.length, 1);
        const stored = await store.run(c, async r => ({ ok: true, value: await r.notes.get() }));
        assert.equal(stored.ok && stored.value?.version, p.handoff.version + 1);
        // Regenerar con la versión nueva y fallo del proveedor: conserva lo guardado.
        const failing = createHandoffNoteService({ unitOfWork: store, provider: provider(req => ({ ok: false, fence: req.fence, reason: "timeout" })).impl });
        const failed = await failing.suggest(c, { ...input, idempotencyKey: "db-key-2", expectedVersion: p.handoff.version + 1 });
        assert.deepEqual(failed, { ok: false, code: "PROVIDER_TIMEOUT" });
        const kept = await store.run(c, async r => ({ ok: true, value: await r.notes.get() }));
        assert.deepEqual(kept.ok && kept.value, stored.ok && stored.value);
      } finally { await fixtures.dispose(p.executionId); }
    });

    await t.test("un reset durante la llamada IA no guarda en la ejecución nueva", async () => {
      const p = await fixtures.prepare(BASE_FIXTURE);
      const c: CommandContext = { executionId: p.executionId, executionVersion: 1, principal: { kind: "system" }, actorId: null, origin: "system", operationalNow: BASE_FIXTURE.operationalAt, narrativeNow: BASE_FIXTURE.narrativeAt, correlationId: "correlation_t09_reset" };
      const old = (await store.current())!;
      const next: Execution = { ...old, executionId: `execution_${randomUUID()}`, version: 1 };
      try {
        const slow = provider(async req => {
          await store.run(c, async r => { assert.ok(await r.replaceExecution(next, old.version)); return { ok: true, value: null }; });
          return echoTickets(req);
        });
        const r = await createHandoffNoteService({ unitOfWork: store, provider: slow.impl }).prepare(c);
        assert.deepEqual(r, { ok: false, code: "EXECUTION_STALE" });
        const successor = await store.run({ ...c, executionId: next.executionId }, async tx => ({ ok: true, value: await tx.notes.get() }));
        assert.equal(successor.ok && successor.value, null);
      } finally {
        await db.$transaction(async tx => {
          await tx.$executeRaw`DELETE FROM executions WHERE "executionId"=${p.executionId} OR "executionId"=${next.executionId}`;
        });
        await fixtures.dispose(p.executionId).catch(() => {});
      }
    });
  } finally { await db.$disconnect(); }
});
