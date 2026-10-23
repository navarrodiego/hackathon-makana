import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptSnapshot } from "../../src/lib/client/state/accept";
import { eventText } from "../../src/components/registro/event-text";
import { tallyNotices } from "../../src/components/registro/resultados-aviso";

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
