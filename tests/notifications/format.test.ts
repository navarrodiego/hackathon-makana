import assert from "node:assert/strict";
import test from "node:test";
import { handoffMessage, incidentMessage, incidentTitle } from "../../src/lib/server/notifications/format";
import { createRequestValidator } from "../../src/lib/server/http/validate";

test("título de incidente usa la fórmula del contrato y no inventa servicio", () => {
  assert.equal(incidentTitle({ service: "facturacion", condition: "caida" }), "P1 · Facturación caída");
  assert.equal(incidentTitle({ service: null, condition: null }), "P1 · Incidente por revisar");
});
test("relevo: solo enlace de revisión con token; sin acciones HTTP", () => {
  const m = handoffMessage("https://app.test", "handoff_1", "tok-1");
  assert.equal(m.click, "https://app.test/relevo/handoff_1?token=tok-1");
  assert.equal(m.actions, undefined);
});
test("incidente: acción POST Tomar incidente con bearer y cuerpo C12", () => {
  const m = incidentMessage({ service: "facturacion", condition: "caida" }, {
    appOrigin: "https://app.test", incidentId: "incident_1", attemptId: "incident_attempt_1", executionId: "execution_now",
    expectedVersion: 3, notificationId: "notification_1", token: "tok-2",
  });
  const a = m.actions![0];
  assert.deepEqual([a.action, a.label, a.method, a.url], ["http", "Tomar incidente", "POST", "https://app.test/api/ack/incident_1"]);
  assert.equal(a.headers.Authorization, "Bearer tok-2");
  assert.deepEqual(JSON.parse(a.body), { executionId: "execution_now", expectedVersion: 3, attemptId: "incident_attempt_1", idempotencyKey: "ack.notification_1" });
  assert.equal(m.click, undefined);
});
test("incidente: el cuerpo de la acción pasa el validador de POST /api/ack/[id] (el teléfono no puede corregirlo)", () => {
  const id = "incident_00000000-0000-4000-8000-000000000000";
  const m = incidentMessage({ service: "facturacion", condition: "caida" }, {
    appOrigin: "https://app.test", incidentId: id, attemptId: "incident_attempt_00000000-0000-4000-8000-000000000000",
    executionId: "execution_00000000-0000-4000-8000-000000000000", expectedVersion: 2,
    notificationId: "notification_00000000-0000-4000-8000-000000000000", token: "tok-3",
  });
  const parsed = createRequestValidator().parse("POST /api/ack/[id]", { body: JSON.parse(m.actions![0].body), params: { id } });
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
});
