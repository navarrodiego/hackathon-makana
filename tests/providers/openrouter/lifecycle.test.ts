import assert from "node:assert/strict";
import test from "node:test";
import { createOpenRouterProvider } from "../../../src/lib/server/providers/openrouter/index";
import { chat, classifyRequest, decisions, evidence, note, noteRequest, transport } from "./helpers";

function manualTiming() {
  let now = 0;
  const pending = new Set<{ at: number; callback: () => void }>();
  return {
    now: () => now,
    schedule(delay: number, callback: () => void) {
      const item = { at: now + delay, callback }; pending.add(item);
      return () => { pending.delete(item); };
    },
    advance(ms: number) { now += ms; for (const item of [...pending]) if (item.at <= now) { pending.delete(item); item.callback(); } },
    get activeTimers() { return pending.size; },
  };
}
for (const status of [401, 402, 429, 500, 502, 503]) {
  test(`HTTP ${status} is unavailable and never retried or leaked`, async () => {
    let calls = 0;
    const provider = createOpenRouterProvider({ apiKey: "private-key", fetch: async () => { calls++; return new Response("private-provider-details", { status }); } });
    assert.deepEqual(await provider.suggest(noteRequest), { ok: false, fence: noteRequest.fence, reason: "provider_unavailable" });
    assert.equal(calls, 1);
  });
}
test("network errors are returned without their sensitive message", async () => {
  const result = await createOpenRouterProvider({ apiKey: "private-key", fetch: async () => { throw new Error("private-key"); } }).suggest(noteRequest);
  assert.deepEqual(result, { ok: false, fence: noteRequest.fence, reason: "provider_unavailable" });
});
test("empty key fails closed before invoking transport", async () => {
  let calls = 0;
  const provider = createOpenRouterProvider({ apiKey: "", fetch: transport(() => { calls++; }) });
  assert.deepEqual(await provider.classify(classifyRequest), { ok: false, fence: classifyRequest.fence, reason: "provider_unavailable" });
  assert.equal(calls, 0);
});
test("classification starts both branches together and times out at 2500ms even when fetch ignores abort", async () => {
  const timing = manualTiming();
  const signals: AbortSignal[] = [];
  const releases: (() => void)[] = [];
  const provider = createOpenRouterProvider({ apiKey: "test", timing, fetch: (url, init) => {
    signals.push(init!.signal!);
    return new Promise(resolve => releases.push(() => resolve(Response.json(String(url).endsWith("/decisions") ? decisions() : chat(evidence)))));
  } });
  const promise = provider.classify(classifyRequest);
  assert.equal(signals.length, 2);
  timing.advance(2499);
  assert.equal(signals[0].aborted, false);
  timing.advance(1);
  assert.deepEqual(await promise, { ok: false, fence: classifyRequest.fence, reason: "timeout" });
  assert.ok(signals.every(signal => signal.aborted));
  releases.forEach(release => release());
  await Promise.resolve();
  assert.equal(timing.activeTimers, 0);
});
test("body reading shares the classification deadline", async () => {
  const timing = manualTiming();
  const provider = createOpenRouterProvider({ apiKey: "test", timing, fetch: async () => new Response(new ReadableStream({ start() {} })) });
  const promise = provider.classify(classifyRequest);
  await Promise.resolve();
  timing.advance(2500);
  assert.deepEqual(await promise, { ok: false, fence: classifyRequest.fence, reason: "timeout" });
});
test("note uses its separate 15000ms deadline", async () => {
  const timing = manualTiming();
  let signal: AbortSignal | null = null;
  const provider = createOpenRouterProvider({ apiKey: "test", timing, fetch: async (_url, init) => {
    signal = init!.signal!; return new Promise<Response>(() => {});
  } });
  const promise = provider.suggest(noteRequest);
  timing.advance(2500);
  assert.equal((signal as AbortSignal | null)?.aborted, false);
  timing.advance(12500);
  assert.deepEqual(await promise, { ok: false, fence: noteRequest.fence, reason: "timeout" });
});
test("configured note deadline is applied independently", async () => {
  const timing = manualTiming();
  const provider = createOpenRouterProvider({ apiKey: "test", timing, noteTimeoutMs: 100, fetch: async () => new Promise<Response>(() => {}) });
  const promise = provider.suggest(noteRequest); timing.advance(100);
  assert.deepEqual(await promise, { ok: false, fence: noteRequest.fence, reason: "timeout" });
});
test("already aborted signal causes no network requests", async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort("private-reason");
  const provider = createOpenRouterProvider({ apiKey: "test", fetch: transport(() => { calls++; }) });
  assert.deepEqual(await provider.classify(classifyRequest, controller.signal), { ok: false, fence: classifyRequest.fence, reason: "provider_unavailable" });
  assert.equal(calls, 0);
});
test("external cancellation aborts both branches and removes timer/listener", async () => {
  const timing = manualTiming(); const controller = new AbortController(); const signals: AbortSignal[] = [];
  const provider = createOpenRouterProvider({ apiKey: "test", timing, fetch: async (_url, init) => {
    signals.push(init!.signal!); return new Promise<Response>(() => {});
  } });
  const promise = provider.classify(classifyRequest, controller.signal);
  controller.abort("secret");
  assert.deepEqual(await promise, { ok: false, fence: classifyRequest.fence, reason: "provider_unavailable" });
  assert.ok(signals.every(s => s.aborted)); assert.equal(timing.activeTimers, 0);
});
test("failure in one branch aborts its sibling", async () => {
  const timing = manualTiming(); const signals: AbortSignal[] = [];
  const provider = createOpenRouterProvider({ apiKey: "test", timing, fetch: async (url, init) => {
    signals.push(init!.signal!);
    if (String(url).endsWith("/decisions")) return Response.json({ answers: {} });
    return new Promise<Response>(() => {});
  } });
  const promise = provider.classify(classifyRequest);
  // Give fetch/JSON continuations a turn; validation must not wait for its sibling.
  await new Promise(resolve => setImmediate(resolve));
  const abortedBeforeDeadline = signals.every(s => s.aborted);
  timing.advance(2500);
  const result = await promise;
  assert.equal(abortedBeforeDeadline, true);
  assert.deepEqual(result, { ok: false, fence: classifyRequest.fence, reason: "invalid_output" });
});
test("a successful operation cleans its deadline and ignores later cancellation", async () => {
  const timing = manualTiming(); const controller = new AbortController();
  const provider = createOpenRouterProvider({ apiKey: "test", timing, fetch: async () => Response.json(chat(note)) });
  const result = await provider.suggest(noteRequest, controller.signal);
  assert.equal(result.ok, true); assert.equal(timing.activeTimers, 0);
  controller.abort(); timing.advance(20000);
  assert.equal(result.ok, true);
});

test("body network failure remains unavailable instead of invalid JSON", async () => {
  const provider = createOpenRouterProvider({ apiKey: "test", fetch: async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError("private network error")); },
  })) });
  assert.deepEqual(await provider.suggest(noteRequest), { ok: false, fence: noteRequest.fence, reason: "provider_unavailable" });
});
