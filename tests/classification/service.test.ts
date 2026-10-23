import assert from "node:assert/strict";
import test from "node:test";
import { createClassificationService } from "../../src/lib/server/classification";
import type { AsyncFence } from "../../src/lib/contracts/core";
import type { ClassificationOutput, ProviderRequest, ProviderResult } from "../../src/lib/contracts/classification";
import { context, output, provenance, providerReturning, report } from "./helpers";

type Make = (fence: AsyncFence) => ProviderResult<ClassificationOutput>;
const ok = (patch: Partial<ClassificationOutput> = {}): Make => fence => ({ ok: true, fence, output: output(patch), provenance });
const run = (make: Make, extra = {}) =>
  createClassificationService({ provider: providerReturning(make), ...extra }).classify(context, report);

test("respuesta válida produce modo model con procedencia", async () => {
  const result = await run(ok());
  assert.equal(result.ok && result.value.mode, "model");
});
test("cada fallo del proveedor produce modo degradado con su razón y sin salida inventada", async () => {
  for (const reason of ["timeout", "invalid_output", "provider_unavailable"] as const) {
    const result = await run(fence => ({ ok: false, fence, reason }));
    assert.deepEqual(result.ok && result.value, { mode: "degraded", reportId: "report_1", reason, output: null });
  }
});
test("información insuficiente se degrada y conserva la salida", async () => {
  const result = await run(ok({ sufficientInformation: false }));
  assert.ok(result.ok && result.value.mode === "degraded" && result.value.reason === "insufficient_information" && result.value.output);
});
test("salida fuera de rango se trata como inválida", async () => {
  const result = await run(ok({ pc: 1.5 }));
  assert.ok(result.ok && result.value.mode === "degraded" && result.value.reason === "invalid_output");
});
test("resultado de otra ejecución o ejecución ya no vigente se descarta", async () => {
  const other = await run(fence => ({ ...ok()(fence), fence: { ...fence, executionId: "execution_2" } }));
  assert.deepEqual(other, { ok: false, code: "EXECUTION_STALE" });
  const reset = await run(ok(), { isCurrent: async () => false });
  assert.deepEqual(reset, { ok: false, code: "EXECUTION_STALE" });
});
test("el texto del público solo llega al proveedor como texto a clasificar", async () => {
  let seen: Extract<ProviderRequest, { task: "classification" }> | undefined;
  await createClassificationService({ provider: { classify: async request => { seen = request; return ok()(request.fence); }, suggest: async () => { throw new Error(); } } }).classify(context, report, new AbortController().signal);
  assert.ok(seen);
  assert.deepEqual(Object.keys(seen.input), ["text"]);
  assert.equal(seen.fence.entity.id, "report_1");
});
