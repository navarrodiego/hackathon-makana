import { devices, expect, test } from "@playwright/test";
import {
  BILLING, ORIGIN, activeCoverage, incidentNotice, pressNtfyAction, requireBackend, reset, rows, scriptedReport,
  state, waitNtfy, waitState,
} from "./support/flow";

/**
 * S04/U04 · Reset con trabajo vivo: relevo aceptado, incidente esperando acuse, y receptor, canal y proyector
 * abiertos. La ejecución nueva no hereda nada y los enlaces y acciones viejas no actúan sobre ella.
 */
requireBackend();

test("reset con superficies abiertas: enlaces y acciones viejas no actúan, nada se hereda y no hay falsa cobertura", async ({ browser, request }) => {
  test.setTimeout(150_000);
  const { s: old, handoffNotice } = await activeCoverage(request);

  const pub = await (await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN })).newPage();
  await pub.goto("/canal");
  await pub.getByRole("textbox", { name: "Apodo" }).fill("Visita");
  await pub.getByRole("textbox", { name: "Reporte" }).fill(BILLING);
  await pub.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(pub.getByRole("region", { name: "Tus reportes" }).getByText(/^Reporte 1:/)).toBeVisible();
  const s = await waitState(request, x => x.incidents[0]?.status === "awaiting_ack", "incidente esperando acuse", 45_000);
  const p1 = await waitNtfy(request, incidentNotice(s.incidents[0].id), "aviso P1 a Paula");

  const paula = await (await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN })).newPage();
  await paula.goto(handoffNotice.body.click);
  await expect(paula.getByText(/Aceptaste el relevo/)).toBeVisible();
  const proy = await (await browser.newContext({ baseURL: ORIGIN })).newPage();
  await proy.goto("/proyector");
  await expect(proy.getByText(/: esperando acuse de Paula/)).toBeVisible();

  // Un reporte en vuelo justo antes del reset.
  const inFlight = scriptedReport(request, "La red del local 4 está caída desde hace un minuto.").catch(() => null);
  const fresh = await reset(request);
  await inFlight;
  expect(fresh.executionId).not.toBe(old.executionId);

  // Acción y enlace viejos no actúan ni abren la ejecución nueva.
  const action = await pressNtfyAction(request, p1);
  expect(action.status(), "acción ntfy vieja").not.toBe(200);
  await paula.reload();
  await expect(paula.getByText("Este enlace no permite abrir el relevo")).toBeVisible();

  // Canal: cerrado y sin recibos de la ejecución anterior.
  await expect(pub.getByText("El canal está cerrado por ahora")).toBeVisible();
  await expect(pub.getByText(/^Reporte 1:/)).toHaveCount(0);

  // Proyector: cambia de ejecución sin eventos viejos ni cobertura que ya no existe.
  await expect(proy.getByRole("heading", { name: "Ahora" })).toHaveCount(0);
  await expect(proy.getByText("Cobertura activa de Paula")).toHaveCount(0);
  await expect(proy.getByText("Sin cobertura confirmada")).toBeVisible();

  const now = await state(request);
  expect(now.incidents).toEqual([]);
  expect(now.coverage.status).toBe("unconfirmed");
  expect(now.events.map((e: { kind: string }) => e.kind)).not.toContain("incident_created");
  const [inherited] = await rows<{ n: number }>(`select count(*)::int as n from reports where "executionId"=$1`, [fresh.executionId]);
  expect(inherited.n, "ningún reporte en vuelo se guarda en la ejecución nueva").toBe(0);
  const [grants] = await rows<{ n: number }>(`select count(*)::int as n from recipient_grants where "executionId"=$1`, [fresh.executionId]);
  expect(grants.n, "sin concesiones heredadas").toBe(0);
});
