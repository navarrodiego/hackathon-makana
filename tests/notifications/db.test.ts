import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { localClient } from "../../scripts/db/client";
import type { CommandContext } from "../../src/lib/contracts/auth";
import { INCIDENT_FIXTURE } from "../../src/lib/contracts/fixtures";
import type { NotificationIntent } from "../../src/lib/contracts/domain";
import { hashCredential } from "../../src/lib/server/auth/credentials";
import { registerNotificationIntent } from "../../src/lib/server/events";
import { PostgresPersistence } from "../../src/lib/server/repositories";
import { materializeFixture } from "../../src/lib/server/repositories/fixture-data";
import { executionLock } from "../../src/lib/server/repositories/sql";
import { createInAppTransport, createNotificationService, createNtfyTransport } from "../../src/lib/server/notifications";

// Base propia de T08 (.env.t08, ignorado). Rechaza cualquier destino que no sea esa base local de pruebas.
config({ path: ".env.t08", quiet: true });
const DB_NAME = "relevo_wt_t08_test";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL de la base de pruebas T08: estas pruebas no se omiten.");
const parsed = new URL(url);
if (decodeURIComponent(parsed.pathname.slice(1)) !== DB_NAME || parsed.hostname !== "127.0.0.1" || (parsed.port && parsed.port !== "5432")) {
  throw new Error("Destino no permitido para pruebas T08");
}

const ntfyConfig = { baseUrl: "https://ntfy.test", topic: "TOPICO-SECRETO", appOrigin: "https://relevo.test", timeoutMs: 1_000 };

async function setup() {
  const db = localClient(url!);
  const store = new PostgresPersistence(db);
  const prepared = await db.$transaction(async tx => {
    await executionLock(tx);
    const active = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM executions WHERE status='active'`;
    if (active[0].n) throw new Error("La base de pruebas ya tiene ejecución activa");
    return materializeFixture(tx, INCIDENT_FIXTURE);
  }, { timeout: 15_000 });
  const ctx: CommandContext = {
    executionId: prepared.executionId, executionVersion: 1, principal: { kind: "system" }, actorId: null, origin: "system",
    operationalNow: INCIDENT_FIXTURE.operationalAt, narrativeNow: INCIDENT_FIXTURE.narrativeAt, correlationId: "correlation_t08",
  };
  const made = await store.run(ctx, async tx => {
    const [incident] = await tx.aggregates.incidents.list();
    const [attempt] = await tx.aggregates.incidentAttempts.list();
    const { intent } = await registerNotificationIntent(tx, ctx, {
      subject: { kind: "incident", id: incident.id, attemptId: attempt.id }, recipientActorId: attempt.candidateActorId, channel: "ntfy",
    });
    return { ok: true, value: intent };
  });
  assert.ok(made.ok);
  const dispose = async (extraExecution?: string) => {
    await db.$transaction(async tx => {
      await executionLock(tx);
      if (extraExecution) await tx.$executeRaw`DELETE FROM executions WHERE "executionId"=${extraExecution}`;
      await tx.$executeRaw`DELETE FROM executions WHERE "executionId"=${prepared.executionId}`;
      await tx.$executeRaw`DELETE FROM report_sessions WHERE id=${prepared.sessionId} AND NOT EXISTS(SELECT 1 FROM reports WHERE "sessionId"=${prepared.sessionId})`;
    }, { timeout: 15_000 });
    await db.$disconnect();
  };
  const read = async () => {
    const r = await store.run(ctx, async tx => ({ ok: true, value: { intents: await tx.aggregates.notifications.list(), events: await tx.events.list() } }));
    assert.ok(r.ok); return r.value;
  };
  const service = (fetchImpl: typeof fetch) => createNotificationService({
    uow: store, transports: { ntfy: createNtfyTransport({ config: ntfyConfig, uow: store, fetch: fetchImpl }), in_app: createInAppTransport() },
  });
  return { db, store, ctx, intent: made.value as NotificationIntent, dispose, read, service };
}

test("PostgreSQL: aceptación del proveedor se guarda con evento y concesión limitada (solo hash)", async () => {
  const s = await setup();
  try {
    let sent: { actions: { headers: { Authorization: string } }[] } | null = null;
    const fetchOk = (async (_: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ id: "prov-1" })); }) as unknown as typeof fetch;
    assert.deepEqual(await s.service(fetchOk).dispatchPending(s.ctx), { ok: true, value: 1 });
    const { intents, events } = await s.read();
    assert.equal(intents[0].status, "provider_accepted"); assert.equal(intents[0].version, 2);
    const accepted = events.filter(e => e.kind === "notification_provider_accepted");
    assert.equal(accepted.length, 1); assert.equal(accepted[0].channel, "ntfy"); assert.equal(accepted[0].result, "provider_accepted");
    assert.equal(JSON.stringify(events).includes("TOPICO-SECRETO"), false);
    const token = sent!.actions[0].headers.Authorization.slice(7);
    const grant = await s.store.run(s.ctx, async tx => ({ ok: true, value: await tx.credentials.findGrant(hashCredential(token)) }));
    assert.ok(grant.ok && grant.value);
    assert.deepEqual(grant.value.scope.actions, ["take_incident"]);
    assert.equal(JSON.stringify(grant.value).includes(token), false);
    assert.equal(JSON.stringify(await s.db.$queryRaw`SELECT * FROM recipient_grants`).includes(token), false);
  } finally { await s.dispose(); }
});

test("PostgreSQL: despachadores concurrentes registran un único resultado", async () => {
  const s = await setup();
  try {
    let sends = 0;
    const fetchOk = (async () => { sends++; await new Promise(r => setTimeout(r, 30)); return new Response(JSON.stringify({ id: "p" })); }) as unknown as typeof fetch;
    // Instancias distintas: simulan procesos separados, sin el conjunto en vuelo compartido.
    await Promise.all([s.service(fetchOk).dispatchPending(s.ctx), s.service(fetchOk).dispatchPending(s.ctx), s.service(fetchOk).dispatchPending(s.ctx)]);
    const { intents, events } = await s.read();
    assert.equal(intents[0].status, "provider_accepted"); assert.equal(intents[0].version, 2);
    assert.equal(events.filter(e => e.kind === "notification_provider_accepted").length, 1, "un solo evento");
    assert.ok(sends >= 1 && sends <= 3, `envíos externos observados: ${sends} (límite documentado: sin exactamente una vez)`);
  } finally { await s.dispose(); }
});

test("PostgreSQL: resultado de una ejecución retirada por reset durante el envío no se guarda ni toca la sucesora", async () => {
  const s = await setup();
  let successor = "";
  try {
    const reset = (async () => {
      const done = await s.store.run(s.ctx, async tx => {
        const [current] = await tx.aggregates.executions.list();
        successor = `execution_${randomUUID()}`;
        const repos = await tx.replaceExecution({ ...current, executionId: successor as never, version: 1, status: "active", supersededBy: null }, current.version);
        return repos ? { ok: true, value: true } : { ok: false, code: "STATE_CONFLICT" };
      });
      assert.ok(done.ok, "el reset simulado debe completarse");
      return new Response(JSON.stringify({ id: "tarde" }));
    }) as unknown as typeof fetch;
    assert.deepEqual(await s.service(reset).dispatchPending(s.ctx), { ok: true, value: 0 });
    const old = await s.db.$queryRaw<{ status: string }[]>`SELECT status FROM executions WHERE "executionId"=${s.ctx.executionId}`;
    assert.equal(old[0].status, "superseded");
    const rows = await s.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM events WHERE "executionId" IN (${s.ctx.executionId}, ${successor}) AND kind IN ('notification_provider_accepted','notification_failed','notification_in_app')`;
    assert.equal(rows[0].n, 0, "ni la ejecución retirada ni la sucesora reciben el resultado viejo");
    const pending = await s.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM notification_intents WHERE "executionId"=${s.ctx.executionId} AND status='pending'`;
    assert.equal(pending[0].n, 1);
  } finally {
    await s.dispose(successor);
  }
});

test("PostgreSQL: fallo reintentable persiste evento y el aviso sigue pendiente; ntfy caído no marca recepción", async () => {
  const s = await setup();
  try {
    const down = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await s.service(down).dispatchPending(s.ctx);
    const { intents, events } = await s.read();
    assert.equal(intents[0].status, "pending");
    assert.equal(events.filter(e => e.kind === "notification_failed").length, 1);
    assert.equal(events.some(e => e.kind === "notification_provider_accepted"), false);
  } finally { await s.dispose(); }
});
