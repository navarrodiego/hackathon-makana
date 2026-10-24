import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout } from "../../src/lib/client/fetch-timeout";

const hanging: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
});

test("a request that never answers is aborted after its timeout", async () => {
  const started = Date.now();
  await assert.rejects(fetchWithTimeout("/x", { timeoutMs: 30 }, hanging));
  assert.ok(Date.now() - started < 1000);
});

test("an external abort still cancels the request", async () => {
  const controller = new AbortController();
  const pending = fetchWithTimeout("/x", { timeoutMs: 10_000, signal: controller.signal }, hanging);
  controller.abort();
  await assert.rejects(pending);
});

test("a timely response is returned untouched", async () => {
  const response = await fetchWithTimeout("/x", { timeoutMs: 1000 }, async () => new Response("ok"));
  assert.equal(await response.text(), "ok");
});

test("the deadline also covers reading a body that stalls", async () => {
  const stalled: typeof fetch = async (_input, init) => new Response(new ReadableStream({
    start(c) { init?.signal?.addEventListener("abort", () => c.error(init.signal!.reason), { once: true }); },
  }));
  const response = await fetchWithTimeout("/x", { timeoutMs: 30 }, stalled);
  await assert.rejects(response.text());
});
