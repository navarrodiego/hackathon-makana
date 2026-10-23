import assert from "node:assert/strict";
import test from "node:test";
import { createNtfyTransport } from "../../src/lib/server/notifications/ntfy";
import { ctx, fakeUow, intent, world } from "./helpers";

const config = { baseUrl: "https://ntfy.test", topic: "TOPICO-SECRETO", appOrigin: "https://relevo.test", timeoutMs: 50 };
const reply = (status: number, body: unknown = { id: "prov-1" }) => async () => new Response(JSON.stringify(body), { status });
const build = (fetchImpl: typeof fetch, w = world()) => ({ w, t: createNtfyTransport({ config, uow: fakeUow(w), fetch: fetchImpl }) });

test("sin configuración: deshabilitado y no entrega", async () => {
  const t = createNtfyTransport({ config: null, uow: fakeUow(world()) });
  assert.equal(t.enabled, false);
});
test("2xx: provider_accepted con id; publica tópico y acción POST; guarda concesión solo con hash", async () => {
  let sent: { url: string; body: { topic: string; actions: { label: string; headers: Record<string, string> }[] } } | null = null;
  const { w, t } = build((async (url: string, init: RequestInit) => { sent = { url, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ id: "prov-1" })); }) as unknown as typeof fetch);
  const r = await t.deliver(ctx(), intent());
  assert.deepEqual(r, { kind: "provider_accepted", acceptedAt: "2026-10-23T15:00:10.000Z", providerMessageId: "prov-1" });
  assert.equal(sent!.url, "https://ntfy.test");
  assert.equal(sent!.body.topic, "TOPICO-SECRETO");
  assert.equal(sent!.body.actions[0].label, "Tomar incidente");
  assert.equal(w.grants.length, 1);
  assert.equal(JSON.stringify(w.grants[0]).includes(sent!.body.actions[0].headers.Authorization.slice(7)), false);
  assert.deepEqual(w.grants[0].scope.actions, ["take_incident"]);
});
test("4xx rechazo no reintentable; 5xx y 429 reintentables; red caída = unavailable", async () => {
  assert.deepEqual(await build(reply(400) as never).t.deliver(ctx(), intent()), { kind: "failed", reason: "rejected", retryable: false });
  assert.deepEqual(await build(reply(503) as never).t.deliver(ctx(), intent()), { kind: "failed", reason: "unavailable", retryable: true });
  assert.deepEqual(await build(reply(429) as never).t.deliver(ctx(), intent()), { kind: "failed", reason: "unavailable", retryable: true });
  assert.deepEqual(await build((async () => { throw new TypeError("fetch failed https://ntfy.test TOPICO-SECRETO"); }) as never).t.deliver(ctx(), intent()), { kind: "failed", reason: "unavailable", retryable: true });
});
test("tiempo agotado: timeout reintentable", async () => {
  const hang = ((_: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
  assert.deepEqual(await build(hang).t.deliver(ctx(), intent()), { kind: "failed", reason: "timeout", retryable: true });
});
test("ningún resultado ni error expone tópico o token", async () => {
  const { t } = build((async () => { throw new Error("TOPICO-SECRETO"); }) as never);
  assert.equal(JSON.stringify(await t.deliver(ctx(), intent())).includes("TOPICO-SECRETO"), false);
});
test("intento ya no vigente: descarta sin llamar al proveedor ni emitir concesión", async () => {
  let calls = 0;
  const w = world(); w.incident = { ...w.incident!, currentAttemptId: "incident_attempt_2" as never };
  const { t } = build((async () => { calls++; return new Response("{}"); }) as never, w);
  assert.deepEqual(await t.deliver(ctx(), intent()), { kind: "discarded", reason: "stale_attempt" });
  assert.equal(calls, 0); assert.equal(w.grants.length, 0);
});
test("ejecución reemplazada: descarta stale_execution sin enviar", async () => {
  let calls = 0;
  const w = world({ currentExecution: "execution_new" });
  const { t } = build((async () => { calls++; return new Response("{}"); }) as never, w);
  assert.deepEqual(await t.deliver(ctx(), intent()), { kind: "discarded", reason: "stale_execution" });
  assert.equal(calls, 0);
});
test("relevo: concesión de lectura/aceptar/rechazar y enlace con token", async () => {
  let body: { click: string } = { click: "" };
  const w = world(); w.handoff = { executionId: "execution_now", version: 2, id: "handoff_1", status: "awaiting_candidate", currentAttemptId: "handoff_attempt_1" } as never;
  w.handoffAttempt = { id: "handoff_attempt_1", status: "pending", candidateActorId: "actor_paula" } as never;
  const { t } = build((async (_: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return new Response("{}"); }) as never, w);
  const r = await t.deliver(ctx(), intent({ subject: { kind: "handoff", id: "handoff_1", attemptId: "handoff_attempt_1" } as never }));
  assert.equal(r.kind, "provider_accepted");
  assert.match(body.click, /^https:\/\/relevo\.test\/relevo\/handoff_1\?token=/);
  assert.deepEqual(w.grants[0].scope.actions, ["read_handoff", "accept_handoff", "reject_handoff"]);
});
