import assert from "node:assert/strict";
import test from "node:test";
import { createClassificationService } from "../../src/lib/server/classification";
import { decide } from "../../src/lib/server/policy";
import { CASES } from "../fixtures/classification/cases";
import { context, provenance, providerReturning, report } from "./helpers";

test("el conjunto tiene 20 casos con la distribución de QA", () => {
  const count = (group: string) => CASES.filter(item => item.group === group).length;
  assert.deepEqual([CASES.length, count("critico"), count("degradado"), count("solicitud_localizado"), count("manipulacion"), count("ambiguo")], [20, 6, 4, 5, 3, 2]);
});
for (const item of CASES) {
  test(`${item.id}: ${item.why}`, async () => {
    const service = createClassificationService({ provider: providerReturning(fence =>
      item.provider.ok ? { ok: true, fence, output: item.provider.output, provenance } : { ok: false, fence, reason: item.provider.reason }) });
    const result = await service.classify(context, { ...report, text: item.text });
    assert.ok(result.ok);
    assert.equal(decide(result.value).route, item.expectedRoute);
  });
}
