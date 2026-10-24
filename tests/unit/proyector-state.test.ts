import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptSnapshot } from "../../src/lib/client/state/accept";
import { eventText } from "../../src/components/registro/event-text";
import { tallyNotices } from "../../src/components/registro/resultados-aviso";
import { relato } from "../../src/components/proyector/relato";

const snap = (executionId: string, version: number, at: string) => ({ executionId, version, clocks: { operationalNow: at } }) as never;

test("acepta el primer snapshot y los que avanzan", () => {
  const a = snap("execution_1", 2, "2026-10-23T22:00:00Z");
  assert.equal(acceptSnapshot(null, a)?.executionChanged, false);
  assert.ok(acceptSnapshot(a, snap("execution_1", 3, "2026-10-23T22:00:01Z")));
});
test("descarta respuestas viejas de la misma ejecución", () => {
  const a = snap("execution_1", 5, "2026-10-23T22:00:05Z");
  assert.equal(acceptSnapshot(a, snap("execution_1", 4, "2026-10-23T22:00:06Z")), null);
  assert.equal(acceptSnapshot(a, snap("execution_1", 5, "2026-10-23T22:00:04Z")), null);
});
test("una ejecución nueva reemplaza a la anterior y lo marca", () => {
  const r = acceptSnapshot(snap("execution_1", 9, "2026-10-23T22:00:00Z"), snap("execution_2", 1, "2026-10-23T22:01:00Z"));
  assert.equal(r?.executionChanged, true);
});
test("el registro no afirma recepción ni resolución", () => {
  const kinds = ["notification_provider_accepted", "incident_taken", "notification_in_app", "coverage_unconfirmed"] as const;
  for (const kind of kinds) {
    const t = eventText({ kind, actor: { id: "actor_x", displayName: "Paula" }, result: "recorded", channel: "ntfy" } as never);
    assert.doesNotMatch(t, /recibi|resuelt|despert/i, t);
  }
  assert.equal(eventText({ kind: "notification_provider_accepted", actor: { id: "actor_x", displayName: "Paula" }, result: "provider_accepted", channel: "ntfy" } as never), "Envío aceptado por ntfy para Paula");
});
test("separa ntfy, in-app, acuse y escenario", () => {
  const t = tallyNotices({
    notifications: [{ channel: "ntfy", status: "provider_accepted" }, { channel: "in_app", status: "in_app_recorded" }, { channel: "ntfy", status: "failed" }],
    incidents: [{ takenBy: { id: "a", displayName: "Tomás" } }, { takenBy: null }],
    events: [{ origin: "scenario" }, { origin: "web" }],
  } as never);
  assert.deepEqual(t, { ntfyAccepted: 1, inAppRecorded: 1, failed: 1, pending: 0, taken: 1, scenarioEvents: 1 });
});
test("el relato del proyector deja fuera la puesta en escena y los reportes", () => {
  const ev = (sequence: number, kind: string, origin = "web", actor: string | null = null) =>
    ({ id: `e${sequence}`, sequence, kind, origin, actor: actor ? { id: `a_${actor}`, displayName: actor } : null, narrativeAt: "2026-10-23T22:10:00-03:00" }) as never;
  const r = relato([
    ev(1, "execution_started", "scenario"), ev(2, "scene_changed", "scenario"), ev(3, "handoff_accepted", "web", "Paula"),
    ev(4, "report_admitted"), ev(5, "report_admitted"), ev(6, "report_admitted"),
    ev(7, "notification_provider_accepted", "system", "Paula"), ev(8, "incident_taken", "scenario", "Tomás"), ev(9, "handoff_accepted", "scenario", "Tomás"),
  ]);
  assert.deepEqual(r.map(h => h.texto), ["Tomás aceptó el relevo", "Tomás tomó el incidente", "Paula aceptó el relevo"]);
  assert.deepEqual(r.map(h => h.desdeControl), [true, false, false]);
  for (const h of r) assert.doesNotMatch(h.texto, /ntfy|in-app|escena|ejecución|resuelt|despert/i);
});
