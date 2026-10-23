import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationService, MAX_FAILURES } from "../../src/lib/server/notifications/dispatcher";
import { createInAppTransport } from "../../src/lib/server/notifications/in-app";
import type { GatedTransport } from "../../src/lib/server/notifications/ntfy";
import type { NotificationDeliveryResult } from "../../src/lib/contracts/services";
import { ctx, fakeUow, intent, world } from "./helpers";

const stub = (result: NotificationDeliveryResult, enabled = true): GatedTransport & { calls: number } => {
  const s = { enabled, calls: 0, async deliver() { s.calls++; return result; } };
  return s;
};
const svc = (w: ReturnType<typeof world>, ntfy: GatedTransport) => createNotificationService({ uow: fakeUow(w), transports: { ntfy, in_app: createInAppTransport() } });
const accepted: NotificationDeliveryResult = { kind: "provider_accepted", acceptedAt: "2026-10-23T15:00:10.000Z", providerMessageId: "prov-1" };

test("provider_accepted: estado, versión y un evento con canal ntfy; no equivale a recepción", async () => {
  const w = world();
  assert.deepEqual(await svc(w, stub(accepted)).dispatchPending(ctx()), { ok: true, value: 1 });
  assert.equal(w.intents[0].status, "provider_accepted"); assert.equal(w.intents[0].version, 2);
  assert.equal(w.events.length, 1);
  assert.deepEqual([w.events[0].kind, w.events[0].channel, w.events[0].result, w.events[0].entityVersion], ["notification_provider_accepted", "ntfy", "provider_accepted", 2]);
});
test("in-app: registra hecho de escenario con canal in_app", async () => {
  const w = world({ intents: [intent({ id: "notification_2", channel: "in_app", recipientActorId: "actor_tomas", subject: { kind: "coordination", entity: { kind: "execution", id: "execution_now" } } as never })] });
  await svc(w, stub(accepted)).dispatchPending(ctx());
  assert.equal(w.intents[0].status, "in_app_recorded");
  assert.deepEqual([w.events[0].kind, w.events[0].channel, w.events[0].result], ["notification_in_app", "in_app", "recorded"]);
});
test("transporte deshabilitado: intención sigue pendiente y no hay evento", async () => {
  const w = world(); const t = stub(accepted, false);
  assert.deepEqual(await svc(w, t).dispatchPending(ctx()), { ok: true, value: 0 });
  assert.equal(t.calls, 0); assert.equal(w.intents[0].status, "pending"); assert.equal(w.events.length, 0);
});
test("fallo no reintentable: failed con evento; nunca provider_accepted", async () => {
  const w = world();
  await svc(w, stub({ kind: "failed", reason: "rejected", retryable: false })).dispatchPending(ctx());
  assert.equal(w.intents[0].status, "failed");
  assert.deepEqual([w.events[0].kind, w.events[0].result, (w.events[0].details as { failure: string }).failure], ["notification_failed", "failed", "rejected"]);
});
test("fallo reintentable: sigue pendiente, respeta separación y se agota al tope", async () => {
  const w = world(); const s = svc(w, stub({ kind: "failed", reason: "unavailable", retryable: true }));
  await s.dispatchPending(ctx());
  assert.equal(w.intents[0].status, "pending"); assert.equal(w.events.length, 1);
  await s.dispatchPending(ctx({ operationalNow: "2026-10-23T15:00:10.500Z" }));
  assert.equal(w.events.length, 1, "no reintenta antes de la separación mínima");
  for (let i = 1; i < MAX_FAILURES; i++) await s.dispatchPending(ctx({ operationalNow: new Date(Date.parse("2026-10-23T15:00:10.000Z") + i * 3000).toISOString() as never }));
  assert.equal(w.events.length, MAX_FAILURES); assert.equal(w.intents[0].status, "failed");
});
test("intento obsoleto al guardar: discarded sin evento de éxito", async () => {
  const w = world(); const t = stub(accepted);
  const s = svc(w, { enabled: true, async deliver(c, i) { w.incident = { ...w.incident!, currentAttemptId: "incident_attempt_2" as never }; return t.deliver(c, i); } } as GatedTransport);
  assert.deepEqual(await s.dispatchPending(ctx()), { ok: true, value: 0 });
  assert.equal(w.intents[0].status, "discarded"); assert.equal(w.events.length, 0);
});
test("reset durante el envío: resultado antiguo no se guarda", async () => {
  const w = world();
  const s = svc(w, { enabled: true, async deliver() { w.currentExecution = "execution_new"; return accepted; } });
  assert.deepEqual(await s.dispatchPending(ctx()), { ok: true, value: 0 });
  assert.equal(w.intents[0].status, "pending"); assert.equal(w.events.length, 0);
});
test("CAS perdido (otro despachador ganó): no duplica evento", async () => {
  const w = world({ casLoses: true });
  assert.deepEqual(await svc(w, stub(accepted)).dispatchPending(ctx()), { ok: true, value: 0 });
  assert.equal(w.events.length, 0);
});
test("dos despachos concurrentes del mismo proceso envían una vez", async () => {
  const w = world(); const t = stub(accepted); const s = svc(w, t);
  await Promise.all([s.dispatchPending(ctx()), s.dispatchPending(ctx())]);
  assert.equal(t.calls, 1); assert.equal(w.events.length, 1);
});
