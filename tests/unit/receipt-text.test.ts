import assert from "node:assert/strict";
import test from "node:test";
import { receiptLines } from "../../src/components/canal/receipt-text";
import { receiptExample } from "../../src/lib/contracts/examples";
import type { ReportReceiptDTO } from "../../src/lib/contracts/public";

const receipt = (patch: Partial<ReportReceiptDTO>): ReportReceiptDTO => ({ ...receiptExample, ...patch });

test("muestra la clasificación de la IA con etiquetas fijas solo cuando hubo clasificación del modelo", () => {
  const classified = { service: "red_locales", condition: "caida", scope: "local_equipo" } as const;
  assert.equal(receiptLines(receipt({ classificationMode: "model", classified })).classified,
    "Clasificación IA: red de locales, no funciona, un local o equipo.");
  assert.equal(receiptLines(receipt({ classificationMode: "degraded", classified: null })).classified, null);
});
test("fuera de TI no promete incidente ni aviso", () => {
  // «hola» no basta para TI: queda fuera de TI con clasificación degradada por falta de información.
  const lines = receiptLines(receipt({ status: "out_of_scope", classificationMode: "degraded", classified: null, incidentId: null, notificationStatus: "none" }));
  assert.equal(lines.status, "No parece un reporte de TI. No se creó un incidente ni se envió un aviso");
  assert.equal(lines.notice, null);
  assert.equal(lines.degraded, null);
});
test("una emergencia física agrega orientación en cualquier ruta", () => {
  for (const status of ["out_of_scope", "review"] as const) {
    assert.match(receiptLines(receipt({ status, physicalEmergency: true })).emergency ?? "", /131 \(SAMU\)/);
  }
  assert.equal(receiptLines(receipt({ physicalEmergency: false })).emergency, null);
});
