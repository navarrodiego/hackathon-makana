import assert from "node:assert/strict";
import test from "node:test";
import { createSharedState } from "../../src/lib/server/execution/shared-state";

function harness(result: (call: number) => { ok: boolean; value: number } = call => ({ ok: true, value: call })) {
  let now = 0, generation = 0, calls = 0;
  const releases: (() => void)[] = [];
  const shared = createSharedState(() => {
    calls++;
    const call = calls;
    return new Promise<{ ok: boolean; value: number }>(resolve => releases.push(() => resolve(result(call))));
  }, { maxAgeMs: 1_000, now: () => now, generation: () => generation, reusable: r => r.ok });
  return {
    shared, releaseAll: () => { releases.splice(0).forEach(release => release()); },
    get calls() { return calls; },
    advance(ms: number) { now += ms; },
    invalidate() { generation++; },
  };
}

test("concurrent requests share one evaluation", async () => {
  const h = harness();
  const pending = Array.from({ length: 20 }, () => h.shared.get());
  assert.equal(h.calls, 1);
  h.releaseAll();
  const results = await Promise.all(pending);
  assert.ok(results.every(r => r.value === 1));
});

test("a result is reused for under 1000ms from the start of its evaluation, then refreshed", async () => {
  const h = harness();
  const first = h.shared.get(); h.releaseAll(); await first;
  h.advance(999);
  assert.equal((await h.shared.get()).value, 1);
  assert.equal(h.calls, 1);
  h.advance(1);
  const next = h.shared.get(); h.releaseAll();
  assert.equal((await next).value, 2);
});

test("an invalidation is never answered with an earlier evaluation, even one still in flight", async () => {
  const h = harness();
  const before = h.shared.get();
  h.invalidate();
  const after = h.shared.get();
  assert.equal(h.calls, 2);
  h.releaseAll();
  assert.equal((await before).value, 1);
  assert.equal((await after).value, 2);
  h.invalidate();
  const again = h.shared.get(); h.releaseAll();
  assert.equal((await again).value, 3);
});

test("a failed result is shared with its concurrent callers but never reused afterwards", async () => {
  const h = harness(call => ({ ok: call > 1, value: call }));
  const a = h.shared.get(), b = h.shared.get();
  h.releaseAll();
  assert.deepEqual(await a, { ok: false, value: 1 });
  assert.deepEqual(await b, { ok: false, value: 1 });
  const next = h.shared.get(); h.releaseAll();
  assert.deepEqual(await next, { ok: true, value: 2 });
});

test("a thrown evaluation is not reused", async () => {
  let calls = 0;
  const shared = createSharedState(async () => { calls++; if (calls === 1) throw new Error("db"); return { ok: true }; },
    { maxAgeMs: 1_000, now: () => 0, generation: () => 0, reusable: r => r.ok });
  await assert.rejects(shared.get());
  assert.deepEqual(await shared.get(), { ok: true });
  assert.equal(calls, 2);
});
