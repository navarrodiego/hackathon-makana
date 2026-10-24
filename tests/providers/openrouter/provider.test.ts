import assert from "node:assert/strict";
import test from "node:test";
import { createOpenRouterProvider } from "../../../src/lib/server/providers/openrouter/index";
import { stableTiming, chat, classifyRequest, evidence, note, noteRequest, transport } from "./helpers";

test("classify combines Jev decisions with literal evidence and preserves the fence", async () => {
  const calls: { url: string; body: Record<string, unknown>; init: RequestInit }[] = [];
  const provider = createOpenRouterProvider({ timing: stableTiming, apiKey: "test-secret", fetch: transport((url, body, init) => calls.push({ url, body, init })) });
  const result = await provider.classify(classifyRequest);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.output, { service: "facturacion", condition: "caida", scope: "local_equipo", pc: 0.85,
    manipulation: false, blocksBilling: true, sufficientInformation: true, topic: "ti", noTiProbability: 0, physicalEmergency: false, evidence });
  assert.deepEqual(result.fence, classifyRequest.fence);
  assert.equal(result.provenance.api, "decisions");
  assert.equal(result.provenance.model, "typesafe/jev-1.14-20261014");
  assert.equal(calls.length, 2);
  assert.ok(calls.some(c => c.url === "https://openrouter.ai/api/alpha/decisions"));
  const extraction = calls.find(c => c.url.endsWith("/chat/completions"))!;
  assert.equal(extraction.init.cache, "no-store");
  assert.deepEqual(extraction.body.provider, { require_parameters: true });
  const format = extraction.body.response_format as { type: string; json_schema: { strict: boolean } };
  assert.equal(format.type, "json_schema");
  assert.equal(format.json_schema.strict, true);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
});

test("suggest returns all five proposals and a structured note", async () => {
  const provider = createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async () => Response.json(chat(note)) });
  const result = await provider.suggest(noteRequest);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.output, note);
  assert.deepEqual(result.fence, noteRequest.fence);
  assert.equal(result.provenance.api, "structured_chat");
  assert.equal(result.provenance.model, "deepseek/deepseek-v4.1-flash-20261017");
});

test("uses latest DeepSeek Flash snapshot for both chat tasks without reasoning and with strict output", async () => {
  const chatRequests: Record<string, unknown>[] = [];
  const provider = createOpenRouterProvider({ apiKey: "test", timing: stableTiming, fetch: async (url, init) => {
    const body = JSON.parse(String(init?.body));
    if (String(url).endsWith("/decisions")) {
      const { decisions } = await import("./helpers");
      return Response.json(decisions());
    }
    chatRequests.push(body);
    return Response.json(chat(chatRequests.length === 1 ? evidence : note));
  } });
  assert.equal((await provider.classify(classifyRequest)).ok, true);
  assert.equal((await provider.suggest(noteRequest)).ok, true);
  assert.equal(chatRequests.length, 2);
  for (const body of chatRequests) {
    assert.equal(body.model, "deepseek/deepseek-v4.1-flash-1017");
    assert.deepEqual(body.reasoning, { effort: "none", exclude: true });
    assert.ok(Number(body.max_tokens) >= 2048);
  }
});
