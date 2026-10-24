import assert from "node:assert/strict";
import test from "node:test";
import { receiptLine } from "../../src/components/canal/receipt-text";
import { receiptExample } from "../../src/lib/contracts/examples";
import type { ReportReceiptDTO } from "../../src/lib/contracts/public";

const receipt = (patch: Partial<ReportReceiptDTO>): ReportReceiptDTO => ({ ...receiptExample, ...patch });

test("muestra la clasificación de la IA con etiquetas fijas solo cuando hubo clasificación del modelo", () => {
  const classified = { service: "red_locales", condition: "caida", scope: "local_equipo" } as const;
  assert.equal(receiptLine(receipt({ classificationMode: "model", classified })).classified,
    "Clasificación IA: red de locales, no funciona, un local o equipo.");
  assert.equal(receiptLine(receipt({ classificationMode: "degraded", classified: null })).classified, null);
});
test("fuera de TI no promete incidente ni aviso", () => {
  // «hola» no basta para TI: queda fuera de TI con clasificación degradada por falta de información.
  const line = receiptLine(receipt({ status: "out_of_scope", classificationMode: "degraded", classified: null, incidentId: null, notificationStatus: "none" }));
  assert.equal(line.text, "No parece un reporte de TI. No se creó un incidente ni se envió un aviso");
  assert.equal(line.classified, null);
});
test("una emergencia física agrega orientación en cualquier ruta", () => {
  for (const status of ["out_of_scope", "review"] as const) {
    assert.match(receiptLine(receipt({ status, physicalEmergency: true })).emergency ?? "", /131 \(SAMU\)/);
  }
  assert.equal(receiptLine(receipt({ physicalEmergency: false })).emergency, null);
});
test("el incidente dice quién lo tiene o quién lo tomó, nunca que se resolvió", () => {
  const incident = { status: "incident", incidentId: "incident_example" } as const;
  assert.equal(receiptLine(receipt({ ...incident, notifiedTo: "Paula", takenBy: null })).text, "Incidente registrado. Paula aún no lo toma");
  assert.equal(receiptLine(receipt({ ...incident, duplicate: true, notifiedTo: "Paula", takenBy: null })).text, "Incidente ya registrado. Paula aún no lo toma");
  assert.equal(receiptLine(receipt({ ...incident, notifiedTo: null, takenBy: "Tomás" })).text, "Incidente tomado por Tomás");
  assert.equal(receiptLine(receipt({ ...incident, notifiedTo: null, takenBy: null })).text, "Incidente registrado. Nadie lo ha tomado");
  assert.doesNotMatch(JSON.stringify(receiptLine(receipt({ ...incident, notificationStatus: "provider_accepted" }))), /ntfy|resuel/);
});
