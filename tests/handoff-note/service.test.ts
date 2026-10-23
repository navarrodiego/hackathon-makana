import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHandoffNoteService } from "../../src/lib/server/handoff-note/service";
import type { SuggestHandoff } from "../../src/lib/contracts/http";
import { EXECUTION, HANDOFF, OUTPUT, context, memoryUnitOfWork, okResult, provider } from "./fakes";

const input = (over: Partial<SuggestHandoff> = {}): SuggestHandoff => ({ executionId: EXECUTION, idempotencyKey: "key-1", expectedVersion: 1, handoffId: HANDOFF, ...over });

describe("HandoffNoteService.suggest", () => {
  it("genera, guarda la nota con procedencia y aumenta la versión del borrador", async () => {
    const mem = memoryUnitOfWork(), p = provider(okResult);
    const r = await createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl }).suggest(context(), input());
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.version, 2);
    assert.equal(r.value.note.status, "ready");
    assert.deepEqual(r.value.note.saved?.output, OUTPUT);
    assert.equal(mem.state.handoff.version, 2);
    assert.equal(mem.state.handoff.savedSuggestion?.provenance.configurationId, "test-only");
    assert.equal(r.value.note.saved?.output.suggestions.filter(s => s.disposition === "transferir").length, 1);
  });

  it("envía al proveedor los cinco pendientes, el nombre de quien recibe y la política fija", async () => {
    const p = provider(okResult);
    await createHandoffNoteService({ unitOfWork: memoryUnitOfWork().unitOfWork, provider: p.impl }).suggest(context(), input());
    const req = p.calls[0];
    assert.equal(req.input.tickets.length, 5);
    assert.equal(req.input.receiverName, "Paula");
    assert.equal(req.input.policyVersion, "C05-v1");
    assert.deepEqual(req.fence.entity, { kind: "handoff", id: HANDOFF });
    assert.equal(req.fence.version, 1);
  });

  it("Regenerar con otra clave llama otra vez al proveedor", async () => {
    const mem = memoryUnitOfWork(), p = provider(okResult);
    const svc = createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl });
    await svc.suggest(context(), input());
    const second = await svc.suggest(context(), input({ idempotencyKey: "key-2", expectedVersion: 2 }));
    assert.equal(p.calls.length, 2);
    assert.equal(second.ok && second.value.version, 3);
  });

  it("repetir la misma clave devuelve lo mismo sin llamar de nuevo", async () => {
    const mem = memoryUnitOfWork(), p = provider(okResult);
    const svc = createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl });
    const first = await svc.suggest(context(), input());
    const replay = await svc.suggest(context(), input());
    assert.deepEqual(replay, first);
    assert.equal(p.calls.length, 1);
    assert.equal(mem.state.handoff.version, 2);
  });

  it("la misma clave con otro contenido es IDEMPOTENCY_CONFLICT", async () => {
    const svc = createHandoffNoteService({ unitOfWork: memoryUnitOfWork().unitOfWork, provider: provider(okResult).impl });
    await svc.suggest(context(), input());
    assert.deepEqual(await svc.suggest(context(), input({ expectedVersion: 5 })), { ok: false, code: "IDEMPOTENCY_CONFLICT" });
  });

  for (const [reason, code] of [["timeout", "PROVIDER_TIMEOUT"], ["invalid_output", "PROVIDER_FAILED"], ["provider_unavailable", "PROVIDER_FAILED"]] as const) {
    it(`fallo ${reason} → ${code} y conserva lo guardado antes`, async () => {
      const mem = memoryUnitOfWork();
      const good = createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: provider(okResult).impl });
      await good.suggest(context(), input());
      const saved = mem.state.handoff.savedSuggestion;
      const bad = createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: provider(req => ({ ok: false, fence: req.fence, reason })).impl });
      const r = await bad.suggest(context(), input({ idempotencyKey: "key-2", expectedVersion: 2 }));
      assert.deepEqual(r, { ok: false, code });
      assert.equal(mem.state.handoff.savedSuggestion, saved);
      assert.equal(mem.state.handoff.version, 2);
      // Repetir esa clave devuelve el mismo fallo, no queda pendiente.
      assert.deepEqual(await bad.suggest(context(), input({ idempotencyKey: "key-2", expectedVersion: 2 })), { ok: false, code });
    });
  }

  it("un proveedor que lanza excepción es PROVIDER_FAILED", async () => {
    const svc = createHandoffNoteService({ unitOfWork: memoryUnitOfWork().unitOfWork, provider: provider(() => { throw new Error("boom"); }).impl });
    assert.deepEqual(await svc.suggest(context(), input()), { ok: false, code: "PROVIDER_FAILED" });
  });

  it("descarta la respuesta si el reset ocurrió mientras el proveedor respondía (S04)", async () => {
    const mem = memoryUnitOfWork();
    const p = provider(req => { mem.state.currentExecution = "execution_new"; return okResult(req); });
    const r = await createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl }).suggest(context(), input());
    assert.deepEqual(r, { ok: false, code: "EXECUTION_STALE" });
    assert.equal(mem.state.handoff.savedSuggestion, null);
  });

  it("descarta una respuesta cuya identidad de trabajo no coincide", async () => {
    const mem = memoryUnitOfWork();
    const p = provider(req => okResult({ ...req, fence: { ...req.fence, version: 9 } }));
    const r = await createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl }).suggest(context(), input());
    assert.deepEqual(r, { ok: false, code: "EXECUTION_STALE" });
    assert.equal(mem.state.handoff.savedSuggestion, null);
  });

  it("si el borrador cambió durante la llamada, no lo pisa (VERSION_CONFLICT)", async () => {
    const mem = memoryUnitOfWork();
    const p = provider(req => { mem.state.handoff = { ...mem.state.handoff, version: 2 }; return okResult(req); });
    const r = await createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl }).suggest(context(), input());
    assert.deepEqual(r, { ok: false, code: "VERSION_CONFLICT" });
    assert.equal(mem.state.handoff.savedSuggestion, null);
  });

  it("versión esperada vieja → VERSION_CONFLICT sin llamar al proveedor, y la clave queda libre", async () => {
    const mem = memoryUnitOfWork(), p = provider(okResult);
    const svc = createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl });
    assert.deepEqual(await svc.suggest(context(), input({ expectedVersion: 7 })), { ok: false, code: "VERSION_CONFLICT" });
    assert.equal(p.calls.length, 0);
    assert.equal((await svc.suggest(context(), input({ expectedVersion: 1 }))).ok, true);
  });

  it("relevo inexistente → NOT_FOUND; relevo ya enviado → STATE_CONFLICT", async () => {
    const p = provider(okResult);
    const svc = createHandoffNoteService({ unitOfWork: memoryUnitOfWork().unitOfWork, provider: p.impl });
    assert.deepEqual(await svc.suggest(context(), input({ handoffId: "handoff_other" })), { ok: false, code: "NOT_FOUND" });
    const sent = createHandoffNoteService({ unitOfWork: memoryUnitOfWork({ status: "awaiting_candidate" }).unitOfWork, provider: p.impl });
    assert.deepEqual(await sent.suggest(context(), input()), { ok: false, code: "STATE_CONFLICT" });
    assert.equal(p.calls.length, 0);
  });

  it("un destinatario o reportante no puede sugerir", async () => {
    const svc = createHandoffNoteService({ unitOfWork: memoryUnitOfWork().unitOfWork, provider: provider(okResult).impl });
    const r = await svc.suggest(context({ principal: { kind: "reporter", sessionId: "session_x" } }), input());
    assert.deepEqual(r, { ok: false, code: "FORBIDDEN" });
  });

  it("control puede sugerir por el saliente", async () => {
    const svc = createHandoffNoteService({ unitOfWork: memoryUnitOfWork().unitOfWork, provider: provider(okResult).impl });
    const r = await svc.suggest(context({ principal: { kind: "control", operatorId: "demo_control" }, origin: "scenario" }), input());
    assert.equal(r.ok, true);
  });
});

describe("HandoffNoteService.prepare", () => {
  it("guarda la nota del borrador vigente sin clave idempotente ni versión del cliente", async () => {
    const mem = memoryUnitOfWork(), p = provider(okResult);
    const r = await createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl }).prepare(context({ principal: { kind: "system" }, actorId: null, origin: "system" }));
    assert.equal(r.ok && r.value.version, 2);
    assert.equal(mem.state.handoff.savedSuggestion?.output.note, OUTPUT.note);
  });

  it("fallo del proveedor no guarda nada ni finge éxito", async () => {
    const mem = memoryUnitOfWork();
    const svc = createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: provider(req => ({ ok: false, fence: req.fence, reason: "timeout" })).impl });
    assert.deepEqual(await svc.prepare(context({ principal: { kind: "system" } })), { ok: false, code: "PROVIDER_TIMEOUT" });
    assert.equal(mem.state.handoff.savedSuggestion, null);
  });

  it("reset durante la preparación no repuebla la ejecución nueva", async () => {
    const mem = memoryUnitOfWork();
    const p = provider(req => { mem.state.currentExecution = "execution_new"; return okResult(req); });
    const r = await createHandoffNoteService({ unitOfWork: mem.unitOfWork, provider: p.impl }).prepare(context({ principal: { kind: "system" } }));
    assert.deepEqual(r, { ok: false, code: "EXECUTION_STALE" });
    assert.equal(mem.state.handoff.savedSuggestion, null);
  });
});
