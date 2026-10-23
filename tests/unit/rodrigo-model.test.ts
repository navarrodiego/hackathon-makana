import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSendBody, clockLabel, countWords, errorMessage, followUp, noteIssue, reasonIssue, sendPayloadKey,
} from "../../src/components/rodrigo/model";

const instant = (s: string) => s as never;
const paula = { id: "actor_paula", displayName: "Paula" } as never;
const tomas = { id: "actor_tomas", displayName: "Tomás" } as never;
const rodrigo = { id: "actor_rodrigo", displayName: "Rodrigo" } as never;

const coverage = (status: string, actor: unknown = null) => ({
  windowId: "window_1", startsAt: instant("2026-10-24T01:10:00.000Z"), endsAt: instant("2026-10-24T10:00:00.000Z"),
  outgoingEndsAt: instant("2026-10-24T01:10:00.000Z"), status, actor,
}) as never;
const handoff = (status: string, candidate: unknown = null, over: object = {}) => ({
  id: "handoff_1", version: 2, status, attemptId: null, candidate, deadlineAt: null, acceptedAt: null,
  effectiveAt: instant("2026-10-24T01:10:00.000Z"), ...over,
}) as never;

test("cuenta palabras igual que el validador del servidor", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   "), 0);
  assert.equal(countWords("uno  dos\ntres"), 3);
});

test("la nota exige texto y hasta 60 palabras", () => {
  assert.match(noteIssue("") ?? "", /Escribe la nota/);
  assert.equal(noteIssue("a ".repeat(60)), null);
  assert.match(noteIssue("a ".repeat(61)) ?? "", /61 palabras/);
});

test("la razón del pendiente no puede quedar vacía ni pasar de 280 caracteres", () => {
  assert.ok(reasonIssue("  "));
  assert.ok(reasonIssue("x".repeat(281)));
  assert.equal(reasonIssue("Sin tóner; llega el lunes."), null);
});

test("el cuerpo de envío recorta textos y conserva el orden de los pendientes", () => {
  const body = buildSendBody({
    executionId: "execution_1" as never, handoffId: "handoff_1" as never, version: 3, idempotencyKey: "k1",
    note: "  Nota  ", tickets: [{ id: "ticket_1" as never, disposition: "transferir", reason: " Razón " }],
  });
  assert.deepEqual(body, {
    executionId: "execution_1", idempotencyKey: "k1", expectedVersion: 3, handoffId: "handoff_1", note: "Nota",
    tickets: [{ ticketId: "ticket_1", disposition: "transferir", reason: "Razón" }],
  });
});

test("la clave de idempotencia cambia solo cuando cambia el contenido", () => {
  const a = { version: 3, note: "x", tickets: [{ id: "t", disposition: "transferir" as const, reason: "r" }] };
  assert.equal(sendPayloadKey(a), sendPayloadKey({ ...a }));
  assert.notEqual(sendPayloadKey(a), sendPayloadKey({ ...a, note: "y" }));
  assert.notEqual(sendPayloadKey(a), sendPayloadKey({ ...a, version: 4 }));
});

test("la hora se muestra en 24 h de Santiago", () => {
  assert.equal(clockLabel(instant("2026-10-24T01:10:00.000Z")), "22:10");
});

test("enviado sin aceptación no cuenta como cobertura", () => {
  const f = followUp({ handoff: handoff("awaiting_candidate", paula), coverage: coverage("unconfirmed"), outgoing: rodrigo, firstCandidateId: "actor_paula", events: [] });
  assert.equal(f.state, "awaiting");
  assert.equal(f.derivedNotice, null);
  assert.equal(f.coverageNotice, null);
});

test("aceptación anticipada queda programada con la hora de inicio", () => {
  const f = followUp({ handoff: handoff("accepted", paula), coverage: coverage("scheduled", paula), outgoing: rodrigo, firstCandidateId: "actor_paula", events: [] });
  assert.equal(f.state, "scheduled");
  assert.equal(f.startsAtLabel, "22:10");
});

test("derivación a Tomás avisa que no hay que reenviar", () => {
  const f = followUp({ handoff: handoff("awaiting_candidate", tomas), coverage: coverage("unconfirmed"), outgoing: rodrigo, firstCandidateId: "actor_paula", events: [] });
  assert.equal(f.derivedNotice, "Relevo enviado a Tomás; no necesitas reenviarlo.");
});

test("sin cobertura distingue aviso a jefatura registrado de pendiente", () => {
  const base = { handoff: handoff("uncovered"), coverage: coverage("unconfirmed"), outgoing: rodrigo, firstCandidateId: "actor_paula" };
  const pending = followUp({ ...base, events: [{ sequence: 4, kind: "coverage_unconfirmed" }] as never });
  assert.equal(pending.state, "uncovered");
  assert.match(pending.coverageNotice ?? "", /Aviso a jefatura pendiente/);
  const done = followUp({ ...base, events: [{ sequence: 4, kind: "coverage_unconfirmed" }, { sequence: 5, kind: "notification_in_app" }] as never });
  assert.match(done.coverageNotice ?? "", /Aviso a jefatura registrado/);
  assert.doesNotMatch(done.coverageNotice ?? "", /descansar|tranquilo/i);
});

test("los errores explican qué se conserva", () => {
  assert.match(errorMessage("PROVIDER_FAILED", "suggest"), /conserva/);
  assert.match(errorMessage("VERSION_CONFLICT", "send"), /cambió/);
  assert.match(errorMessage("OPERATION_PENDING", "send"), /en curso/);
  assert.match(errorMessage("AUTH_REQUIRED", "send"), /credencial/i);
});
