import assert from "node:assert/strict";
import test from "node:test";
import { equivalence } from "../../src/lib/server/policy";
import { model, output } from "./helpers";

const key = (patch = {}, text = "x") => equivalence({ text }, model(patch));

test("el mismo hecho con otra redacción comparte clave", () => {
  const a = key({ evidence: { location: "Local 7", resource: "Caja 2", problem: "No emite boletas" } });
  const b = key({ evidence: { location: " local  7", resource: "caja 2", problem: "no émite boletas." } });
  assert.deepEqual(a, b);
});
test("hechos o servicios distintos no se colapsan", () => {
  const base = key();
  assert.notDeepEqual(base, key({ service: "red_locales" }));
  assert.notDeepEqual(base, key({ evidence: { ...output().evidence, location: "Local 8" } }));
  assert.notDeepEqual(base, key({ evidence: { ...output().evidence, problem: "sin papel" } }));
});
test("sin evidencia suficiente o en modo degradado usa el texto normalizado", () => {
  assert.deepEqual(key({ evidence: { location: null, resource: null, problem: null } }, "  ¡Hola   Mundo! "), { mode: "text", normalizedText: "hola mundo" });
  assert.equal(equivalence({ text: "Caído" }, { mode: "degraded", reportId: "report_1", reason: "timeout", output: null }).mode, "text");
});
