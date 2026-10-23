import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuthorizationService } from "../../src/lib/contracts/auth";
import type { HandoffNoteService } from "../../src/lib/contracts/services";
import { handleSuggest } from "../../src/lib/server/handoff-note/handle";
import { EXECUTION, HANDOFF, OUTPUT, context } from "./fakes";

const body = { executionId: EXECUTION, idempotencyKey: "key-1", expectedVersion: 1, handoffId: HANDOFF };
const dto = { executionId: EXECUTION, handoffId: HANDOFF, version: 2, note: { status: "ready", saved: { output: OUTPUT, provenance: { provider: "openrouter", api: "structured_chat", model: "m", configurationId: "c" }, generatedAt: "2026-10-23T15:00:00.000Z" } } } as const;

function deps(over: { auth?: AuthorizationService["authorize"]; suggest?: HandoffNoteService["suggest"] } = {}) {
  const seen: { authorized: unknown[]; suggested: unknown[] } = { authorized: [], suggested: [] };
  return { seen, auth: {
    async authorize(input) { seen.authorized.push(input); return over.auth ? over.auth(input) : { ok: true, value: context() }; },
    issueRecipientGrant: async () => { throw new Error("no usado"); },
  } satisfies AuthorizationService, note: {
    async suggest(c, i) { seen.suggested.push(i); return over.suggest ? over.suggest(c, i) : { ok: true, value: dto }; },
    prepare: async () => { throw new Error("no usado"); },
  } satisfies HandoffNoteService };
}
const post = (b: unknown, headers: Record<string, string> = {}) => new Request("http://127.0.0.1:3000/api/handoff/suggest", {
  method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", authorization: "Basic eDp5", ...headers },
  body: typeof b === "string" ? b : JSON.stringify(b),
});

describe("POST /api/handoff/suggest", () => {
  it("responde 200 con el cuerpo del contrato y sin caché", async () => {
    const d = deps();
    const res = await handleSuggest(post(body), () => d);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.deepEqual(json.data, dto);
    assert.equal(json.correlationId, "correlation_t09");
    assert.equal((d.seen.authorized[0] as { route: string }).route, "POST /api/handoff/suggest");
  });

  it("rechaza antes de autorizar: sin JSON, JSON roto, campos extra o sin versión", async () => {
    for (const req of [
      post(body, { "content-type": "text/plain" }), post("{no"), post({ ...body, extra: 1 }),
      post({ executionId: EXECUTION, idempotencyKey: "k", handoffId: HANDOFF }),
    ]) {
      const d = deps();
      const res = await handleSuggest(req, () => d);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, "INVALID_INPUT");
      assert.equal(d.seen.authorized.length, 0);
    }
  });

  it("pasa representedActorId a la autorización y no llama al servicio si falla", async () => {
    const d = deps({ auth: async () => ({ ok: false, code: "ORIGIN_REJECTED" }) });
    const res = await handleSuggest(post({ ...body, representedActorId: "actor_outgoing" }), () => d);
    assert.equal(res.status, 403);
    assert.equal((d.seen.authorized[0] as { representedActorId: string }).representedActorId, "actor_outgoing");
    assert.equal(d.seen.suggested.length, 0);
  });

  for (const [code, status] of [["PROVIDER_FAILED", 502], ["PROVIDER_TIMEOUT", 504], ["EXECUTION_STALE", 409], ["VERSION_CONFLICT", 409]] as const) {
    it(`${code} → ${status} con el mensaje fijo y la correlación autorizada`, async () => {
      const res = await handleSuggest(post(body), () => deps({ suggest: async () => ({ ok: false, code }) }));
      assert.equal(res.status, status);
      const json = await res.json();
      assert.equal(json.error.code, code);
      assert.equal(json.correlationId, "correlation_t09");
    });
  }

  it("si no se puede ensamblar la persistencia responde STORAGE_UNAVAILABLE, no 500", async () => {
    const res = await handleSuggest(post(body), () => { throw new Error("Falta DATABASE_URL"); });
    assert.equal(res.status, 503);
    assert.doesNotMatch(JSON.stringify(await res.json()), /DATABASE_URL/);
  });

  it("no devuelve la credencial ni el cuerpo en errores", async () => {
    const res = await handleSuggest(post(body), () => deps({ auth: async () => ({ ok: false, code: "AUTH_INVALID" }) }));
    assert.doesNotMatch(JSON.stringify(await res.json()), /Basic|eDp5|key-1/);
  });
});
