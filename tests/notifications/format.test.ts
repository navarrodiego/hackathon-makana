import assert from "node:assert/strict";
import test from "node:test";
import { handoffMessage, incidentMessage, incidentTitle } from "../../src/lib/server/notifications/format";

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
  assert.deepEqual(JSON.parse(a.body), { executionId: "execution_now", expectedVersion: 3, attemptId: "incident_attempt_1", idempotencyKey: "ack:notification_1" });
  assert.equal(m.click, undefined);
});
