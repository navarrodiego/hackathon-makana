import assert from "node:assert/strict";
import { test } from "node:test";
import { clip, publicReports } from "../../src/lib/server/state/reports";
import { estadoReporte } from "../../src/components/proyector/reportes";

const report = (n: number, over: Record<string, unknown> = {}) => ({
  id: `report_${n}`, admissionSequence: n, sessionId: "session_secret", nickname: `Persona ${n}`, text: `Texto ${n}`,
  origin: "web", operationalAt: "2026-10-24T01:00:00.000Z", narrativeAt: `2026-10-24T01:0${n}:00.000Z`,
  correlationId: "correlation_x", principalKey: "session:secret", idempotencyKey: "k", status: "completed",
  classification: { mode: "model", output: { secret: "salida" } }, decision: { route: "queue" }, incidentId: null, ...over,
}) as never;
const incident = { id: "incident_1", firstReportId: "report_1" } as never;

test("los reportes de la sala: los más recientes primero, hasta el límite", () => {
  const r = publicReports([1, 2, 3, 4, 5, 6, 7, 8].map(n => report(n)), [], 6);
  assert.deepEqual(r.map(x => x.id), ["report_8", "report_7", "report_6", "report_5", "report_4", "report_3"]);
});

test("cada reporte dice qué pasó con él, como el recibo de quien lo envió", () => {
  const r = publicReports([
    report(1, { incidentId: "incident_1", decision: { route: "notify" } }),
    report(2, { incidentId: "incident_1", decision: { route: "notify" } }),
    report(3, { decision: { route: "review" } }),
    report(4, { decision: { route: "out_of_scope" } }),
    report(5, { status: "processing", decision: null, classification: null }),
    report(6),
  ], [incident]);
  assert.deepEqual(r.map(x => [x.status, x.duplicate]), [
    ["queued", false], ["processing", false], ["out_of_scope", false], ["review", false], ["incident", true], ["incident", false],
  ]);
});

test("solo campos permitidos: sin sesión, principal, clasificación ni decisión", () => {
  const [r] = publicReports([report(1)], []);
  assert.deepEqual(Object.keys(r).sort(), ["duplicate", "id", "narrativeAt", "nickname", "status", "text"]);
  assert.doesNotMatch(JSON.stringify(r), /secret|correlation|salida/);
});

test("recorta textos largos sin partir emojis", () => {
  assert.equal(clip("  corto  ", 10), "corto");
  assert.equal(clip("abcdefghij", 10), "abcdefghij");
  assert.equal(clip("abcdefghijk", 10), "abcdefghi…");
  assert.equal(clip("se cayó 🔥🔥🔥 todo", 10), "se cayó 🔥…");
  assert.equal(clip("palabra      final", 9), "palabra…");
  const [r] = publicReports([report(1, { text: "x".repeat(280), nickname: "n".repeat(40) })], []);
  assert.equal(Array.from(r.text).length, 100);
  assert.equal(r.nickname.length, 40);
});

test("el proyector nombra el resultado como el recibo del teléfono", () => {
  assert.deepEqual(
    (["processing", "queued", "review", "out_of_scope"] as const).map(status => estadoReporte({ status, duplicate: false }).text),
    ["Clasificando…", "En cola para la próxima atención", "En revisión de la guardia", "No parece un reporte de TI"],
  );
  assert.equal(estadoReporte({ status: "incident", duplicate: false }).text, "Incidente registrado");
  assert.equal(estadoReporte({ status: "incident", duplicate: true }).text, "Incidente ya registrado");
});
