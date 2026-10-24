import assert from "node:assert/strict";
import { isSessionProblem, loginErrorMessage } from "../../src/components/acceso/messages";
import { test } from "node:test";
import {
  buildSendBody, clockLabel, countWords, closingLead, errorMessage, followUp, leftSummary, noteIssue, phaseOf, sendPayloadKey,
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

test("la nota es opcional y admite hasta 60 palabras", () => {
  assert.equal(noteIssue(""), null);
  assert.equal(noteIssue("   "), null);
  assert.equal(noteIssue("a ".repeat(60)), null);
  assert.match(noteIssue("a ".repeat(61)) ?? "", /61 palabras/);
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
  assert.match(errorMessage("VERSION_CONFLICT", "send"), /cambió/);
  assert.match(errorMessage("OPERATION_PENDING", "send"), /en curso/);
  assert.match(errorMessage("AUTH_REQUIRED", "send"), /Ingresa de nuevo/);
  // Un origen rechazado no se presenta como problema de contraseña.
  assert.doesNotMatch(errorMessage("ORIGIN_REJECTED", "send"), /contraseña|sesión/);
  assert.match(errorMessage("ORIGIN_REJECTED", "send"), /APP_ORIGIN/);
});

test("ingreso: cada causa tiene su mensaje y el de origen nombra ambas direcciones", () => {
  assert.match(loginErrorMessage("AUTH_INVALID", "outgoing"), /contraseña no coincide/);
  assert.match(loginErrorMessage("AUTH_NOT_CONFIGURED", "control"), /OPERATOR_SECRET/);
  assert.match(loginErrorMessage("ORIGIN_REJECTED", "control", { expected: null, received: "https://x.example" }), /APP_ORIGIN/);
  const m = loginErrorMessage("ORIGIN_REJECTED", "outgoing", { expected: "https://relevo.example", received: "https://www.relevo.example" });
  assert.match(m, /https:\/\/www\.relevo\.example/); assert.match(m, /https:\/\/relevo\.example\/rodrigo/);
  assert.equal(isSessionProblem("AUTH_EXPIRED"), true); assert.equal(isSessionProblem("ORIGIN_REJECTED"), false);
});

test("fase: cierre hasta enviar; mañana solo con relevo enviado y escena de mañana", () => {
  assert.equal(phaseOf(false, "Cierre"), "closing");
  assert.equal(phaseOf(false, "Registro de mañana"), "closing");
  assert.equal(phaseOf(true, null), "following");
  assert.equal(phaseOf(true, "Registro de noche"), "following");
  assert.equal(phaseOf(true, "Registro de mañana"), "morning");
});

test("lo que dejaste: singular/plural y nota solo si existe", () => {
  assert.equal(leftSummary(5, "Revisar #470"), "Lo que dejaste: 5 pendientes y una nota");
  assert.equal(leftSummary(1, ""), "Lo que dejaste: 1 pendiente");
  assert.equal(leftSummary(2, "   "), "Lo que dejaste: 2 pendientes");
});

test("cabecera del cierre: quién entrega y cuántos pendientes deja, con singular/plural", () => {
  assert.equal(closingLead(5), "Rodrigo deja 5 pendientes a quien entra.");
  assert.equal(closingLead(1), "Rodrigo deja 1 pendiente a quien entra.");
});
