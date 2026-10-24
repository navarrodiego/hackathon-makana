import assert from "node:assert/strict";
import test from "node:test";
import { createOpenRouterProvider } from "../../../src/lib/server/providers/openrouter/index";
import { stableTiming, chat, classifyRequest, decisions, evidence, note, noteRequest } from "./helpers";

const invalidClassifications: [string, (value: ReturnType<typeof decisions>) => void][] = [
  ["unknown service", v => { v.answers.service.choice = "database"; }],
  ["unknown condition", v => { v.answers.condition.choice = "resuelto"; }],
  ["unknown scope", v => { v.answers.scope.choice = "all"; }],
  ["invalid boolean label", v => { v.answers.manipulation.choice = "maybe"; }],
  ["invalid nullable boolean label", v => { v.answers.blocksBilling.choice = "null"; }],
  ["pc above 1", v => { v.answers.pc.noul = 1.01; }],
  ["pc below 0", v => { v.answers.pc.noul = -0.01; }],
  ["pc not finite", v => { v.answers.pc.noul = Infinity; }],
  ["wrong primitive", v => { v.answers.pc.type = "score"; }],
  ["unvalidated confidence", v => { v.answers.service.confidence = -1; }],
  ["incomplete probability map", v => { delete v.answers.service.probabilities.facturacion; }],
  ["extra answer", v => { Object.assign(v.answers, { recipient: "Rodrigo" }); }],
  ["unknown topic", v => { v.answers.topic.choice = "deporte"; }],
  ["missing topic", v => { delete (v.answers as Partial<typeof v.answers>).topic; }],
  ["missing physical emergency", v => { delete (v.answers as Partial<typeof v.answers>).physicalEmergency; }],
];
test("classify takes noTiProbability from the topic probabilities, not from its confidence", async () => {
  const output = decisions();
  output.answers.topic = { type: "choice", choice: "no_ti", confidence: 0.5, probabilities: { ti: 0.03, no_ti: 0.91, dudoso: 0.06 } };
  output.answers.physicalEmergency.choice = "true";
  const provider = createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async url => Response.json(String(url).endsWith("/decisions") ? output : chat(evidence)) });
  const result = await provider.classify(classifyRequest);
  assert.ok(result.ok);
  assert.deepEqual([result.output.topic, result.output.noTiProbability, result.output.physicalEmergency], ["no_ti", 0.91, true]);
});
for (const [name, mutate] of invalidClassifications) {
  test(`classify rejects ${name}`, async () => {
    const output = decisions(); mutate(output);
    const provider = createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async url => Response.json(String(url).endsWith("/decisions") ? output : chat(evidence)) });
    assert.deepEqual(await provider.classify(classifyRequest), { ok: false, reason: "invalid_output", fence: classifyRequest.fence });
  });
}
for (const [name, output] of [
  ["invented location", { ...evidence, location: "Local 8" }],
  ["nonliteral capitalization", { ...evidence, location: "local 7" }],
  ["empty evidence", { ...evidence, problem: " " }],
  ["missing field", { location: "Local 7", resource: "caja 2" }],
  ["extra field", { ...evidence, recipient: "Rodrigo" }],
  ["wrong type", { ...evidence, problem: true }],
] as const) {
  test(`classify rejects ${name}`, async () => {
    const provider = createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async url => Response.json(String(url).endsWith("/decisions") ? decisions() : chat(output)) });
    const result = await provider.classify(classifyRequest);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
  });
}
for (const [name, change] of [
  ["omitted ticket", (n: typeof note) => { n.suggestions.pop(); }],
  ["duplicate ticket", (n: typeof note) => { n.suggestions[1] = n.suggestions[0]; }],
  ["foreign ticket", (n: typeof note) => { n.suggestions[0].ticketId = "ticket_foreign"; }],
  ["blank reason", (n: typeof note) => { n.suggestions[0].reason = " \t\n"; }],
  ["extra suggestion field", (n: typeof note) => { Object.assign(n.suggestions[0], { urgent: true }); }],
  ["extra output field", (n: typeof note) => { Object.assign(n, { accepted: true }); }],
  ["wrong disposition", (n: typeof note) => { Object.assign(n.suggestions[0], { disposition: "urgente" }); }],
  ["61 words", (n: typeof note) => { n.note = Array(61).fill("palabra").join("\u2003"); }],
  ["empty note", (n: typeof note) => { n.note = " \n"; }],
] as const) {
  test(`suggest rejects ${name}`, async () => {
    const output = structuredClone(note); change(output);
    const result = await createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async () => Response.json(chat(output)) }).suggest(noteRequest);
    assert.deepEqual(result, { ok: false, reason: "invalid_output", fence: noteRequest.fence });
  });
}
for (const [name, makeResponse] of [
  ["invalid HTTP JSON", () => new Response("<html>invalid</html>")],
  ["invalid message JSON", () => Response.json({ ...chat(note), choices: [{ message: { content: "```json\n{}\n```" }, finish_reason: "stop" }] })],
  ["truncated message", () => Response.json({ ...chat(note), choices: [{ message: { content: JSON.stringify(note) }, finish_reason: "length" }] })],
  ["refusal", () => Response.json({ ...chat(note), choices: [{ message: { content: JSON.stringify(note), refusal: "denied" }, finish_reason: "stop" }] })],
  ["missing model provenance", () => Response.json({ ...chat(note), model: "" })],
] as const) {
  test(`suggest rejects ${name}`, async () => {
    const result = await createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async () => makeResponse() }).suggest(noteRequest);
    assert.deepEqual(result, { ok: false, reason: "invalid_output", fence: noteRequest.fence });
  });
}
test("accepts 60 words separated by Unicode whitespace and reordered proposals", async () => {
  const output = { ...note, note: Array(60).fill("palabra").join("\u00a0\t"), suggestions: [...note.suggestions].reverse() };
  const result = await createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async () => Response.json(chat(output)) }).suggest(noteRequest);
  assert.equal(result.ok, true);
});
test("valid uncertainty stays a datum for T07, not a provider failure", async () => {
  const output = decisions(); output.answers.sufficientInformation.choice = "false"; output.answers.service.choice = "otro";
  output.answers.blocksBilling.choice = "unknown";
  const provider = createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async url => Response.json(String(url).endsWith("/decisions") ? output : chat({ location: null, resource: null, problem: null })) });
  const result = await provider.classify(classifyRequest);
  assert.equal(result.ok, true);
  if (result.ok) { assert.equal(result.output.sufficientInformation, false); assert.equal(result.output.blocksBilling, null); }
});

test("counts Unicode NEL separators at the edges without inventing extra words", async () => {
  const output = { ...note, note: "\u0085" + Array(60).fill("palabra").join("\u0085") + "\u0085" };
  const result = await createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async () => Response.json(chat(output)) }).suggest(noteRequest);
  assert.equal(result.ok, true);
});
test("rejects a note containing only Unicode whitespace", async () => {
  const result = await createOpenRouterProvider({ timing: stableTiming, apiKey: "test", fetch: async () => Response.json(chat({ ...note, note: "\u0085\u0085" })) }).suggest(noteRequest);
  assert.deepEqual(result, { ok: false, fence: noteRequest.fence, reason: "invalid_output" });
});
