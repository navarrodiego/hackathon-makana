import assert from "node:assert/strict";
import test from "node:test";
import { receiptLine } from "../../src/components/canal/receipt-text";
import { receiptExample } from "../../src/lib/contracts/examples";
import type { ReportReceiptDTO } from "../../src/lib/contracts/public";

const receipt = (patch: Partial<ReportReceiptDTO>): ReportReceiptDTO => ({ ...receiptExample, ...patch });

test("cuenta en una frase cómo entendió la IA el mensaje, solo cuando hubo clasificación del modelo", () => {
  const classified = { service: "red_locales", condition: "caida", scope: "local_equipo" } as const;
  assert.equal(receiptLine(receipt({ classificationMode: "model", classified })).classified,
    "La IA entendió: red de locales sin funcionar, afecta a un local o equipo.");
  assert.equal(receiptLine(receipt({ classificationMode: "model", classified: { service: "cuentas", condition: "solicitud", scope: "persona" } })).classified,
    "La IA entendió: solicitud de cuentas y accesos, afecta a una persona.");
  assert.equal(receiptLine(receipt({ classificationMode: "degraded", classified: null })).classified, null);
});
test("fuera de TI no promete incidente ni aviso", () => {
  // «hola» no basta para TI: queda fuera de TI con clasificación degradada por falta de información.
  const line = receiptLine(receipt({ status: "out_of_scope", classificationMode: "degraded", classified: null, incidentId: null, notificationStatus: "none" }));
  assert.equal(line.text, "No parece un problema de TI, así que no se avisó a nadie");
  assert.equal(line.classified, null);
});
test("una emergencia física agrega orientación en cualquier ruta", () => {
  for (const status of ["out_of_scope", "review"] as const) {
    assert.match(receiptLine(receipt({ status, physicalEmergency: true })).emergency ?? "", /131 \(SAMU\)/);
  }
  assert.equal(receiptLine(receipt({ physicalEmergency: false })).emergency, null);
});
test("el incidente dice quién lo tiene o quién lo tomó, nunca que se resolvió", () => {
  const incident = { status: "incident", incidentId: "incident_example", classificationMode: "model" } as const;
  assert.equal(receiptLine(receipt({ ...incident, notifiedTo: "Paula", takenBy: null })).text, "Urgente. Le toca a Paula, que aún no lo toma");
  assert.equal(receiptLine(receipt({ ...incident, duplicate: true, notifiedTo: "Paula", takenBy: null })).text, "Urgente. Ya estaba reportado. Le toca a Paula, que aún no lo toma");
  assert.equal(receiptLine(receipt({ ...incident, notifiedTo: null, takenBy: "Tomás" })).text, "Urgente. Tomás tomó el incidente");
  assert.equal(receiptLine(receipt({ ...incident, notifiedTo: null, takenBy: null })).text, "Urgente. Todavía nadie lo toma");
  assert.doesNotMatch(JSON.stringify(receiptLine(receipt({ ...incident, notificationStatus: "provider_accepted" }))), /ntfy|resuel/);
});
test("no urgente y duda dicen qué se decidió y qué pasa ahora", () => {
  assert.equal(receiptLine(receipt({ status: "queued", incidentId: null, nextAttentionAt: null })).text, "No es urgente. Queda en cola; nadie recibe un aviso ahora");
  assert.equal(receiptLine(receipt({ status: "review", incidentId: null })).text, "No quedó claro si es urgente. Lo revisará una persona de la guardia");
  assert.equal(receiptLine(receipt({ status: "processing", incidentId: null })).text, "Revisando si es urgente…");
});
test("sin clasificación segura no afirma que sea urgente", () => {
  assert.equal(receiptLine(receipt({ status: "incident", classificationMode: "degraded", notifiedTo: null, takenBy: null })).text,
    "Se trata como urgente hasta revisarlo. Todavía nadie lo toma");
});
