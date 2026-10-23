import assert from "node:assert/strict";
import test from "node:test";
import { decide } from "../../src/lib/server/policy";
import { model, output } from "./helpers";

test("umbrales de un servicio crítico: 0,40 revisa y 0,70 avisa", () => {
  const route = (pc: number) => decide(model({ pc })).route;
  assert.deepEqual([0.39, 0.4, 0.69, 0.7, 0.71].map(route), ["queue", "review", "review", "notify", "notify"]);
});
test("generalizado avisa antes de considerar la cola", () => {
  assert.equal(decide(model({ service: "vpn", scope: "generalizado", pc: 0.1 })).route, "notify");
});
test("impresora: bloquea boletas es crítica, administrativa espera, desconocido se revisa", () => {
  assert.equal(decide(model({ service: "impresora", blocksBilling: true, pc: 0.9 })).route, "notify");
  assert.equal(decide(model({ service: "impresora", blocksBilling: false, pc: 0.9 })).route, "queue");
  assert.equal(decide(model({ service: "impresora", blocksBilling: null, pc: 0.1 })).route, "review");
});
test("correo solo es crítico si es generalizado; VPN degradada espera", () => {
  assert.equal(decide(model({ service: "correo", scope: "persona", pc: 0.9 })).route, "queue");
  assert.equal(decide(model({ service: "vpn", condition: "degradacion", scope: "persona", pc: 0.5 })).route, "queue");
});
test("desconocido, datos fuera de rango o falta de información nunca se difieren", () => {
  assert.equal(decide(model({ service: "otro", pc: 0 })).route, "review");
  assert.equal(decide(model({ pc: Number.NaN })).route, "review");
  assert.equal(decide(model({ sufficientInformation: false, pc: 0 })).route, "review");
});
test("modo degradado revisa, incluso con salida parcial", () => {
  const reportId = "report_1";
  for (const reason of ["timeout", "invalid_output", "provider_unavailable", "insufficient_information"] as const) {
    assert.equal(decide({ mode: "degraded", reportId, reason, output: null }).route, "review");
  }
  assert.equal(decide({ mode: "degraded", reportId, reason: "insufficient_information", output: output({ pc: 0 }) }).route, "review");
});
test("la manipulación no cambia la ruta del hecho real", () => {
  assert.deepEqual(decide(model({ manipulation: true })), decide(model({ manipulation: false })));
});
