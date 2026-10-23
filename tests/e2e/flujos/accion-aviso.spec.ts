import { expect, test } from "@playwright/test";
import {
  BILLING, CONTROL_CREDENTIALS, HAS_AI, ORIGIN, WAKE, activeCoverage, eventsOf, incidentNotice, pressNtfyAction,
  requireBackend, rows, scriptedReport, state, tokenOf, waitNtfy, waitState,
} from "./support/flow";

/**
 * I08 (efecto local) · Paula toma el incidente con la acción HTTP de su aviso, tal como la ejecutaría la app ntfy
 * del teléfono. Abrir la URL no actúa, un token de otro alcance no sirve y el doble toque no duplica.
 */
requireBackend();

test("Paula toma el incidente desde la acción del aviso; GET y token cruzado no actúan; doble toque idempotente", async ({ browser, request }) => {
  test.setTimeout(150_000);
  const { s: covered, handoffNotice } = await activeCoverage(request);
  await scriptedReport(request, BILLING);
  let s = await waitState(request, x => x.incidents[0]?.status === "awaiting_ack", "incidente esperando acuse", 45_000);
  const incident = s.incidents[0];
  expect(incident.candidate.displayName).toBe("Paula");
  const p1 = await waitNtfy(request, incidentNotice(incident.id), "aviso P1 a Paula");
  const action = p1.body.actions[0];

  // Abrir la URL de la acción (GET) no toma el incidente (S02).
  const opened = await request.get(action.url);
  expect(opened.status()).toBe(405);
  // El token del aviso de relevo no sirve para acusar un incidente (S01, alcance cruzado).
  const crossed = await request.post(action.url, { headers: { ...action.headers, Authorization: `Bearer ${tokenOf(handoffNotice)}` }, data: action.body });
  expect([401, 403], `token cruzado respondió ${crossed.status()}`).toContain(crossed.status());
  expect((await state(request)).incidents[0].status).toBe("awaiting_ack");

  // La acción del teléfono: sin Origin ni cookies, con su Bearer y su cuerpo.
  const first = await pressNtfyAction(request, p1);
  expect(first.status(), await first.text()).toBe(200);
  const again = await pressNtfyAction(request, p1);
  expect(again.status(), "doble toque con la misma clave").toBe(200);
  s = await waitState(request, x => x.incidents[0]?.status === "taken", "incidente tomado");
  expect(s.incidents[0].takenBy.displayName).toBe("Paula");
  const taken = await eventsOf(s.executionId, "incident_taken");
  expect(taken, "un solo evento de toma").toHaveLength(1);
  expect(taken[0].origin, "origen distinto de escenario").not.toBe("scenario");
  expect(s.events.filter((e: { kind: string }) => e.kind === "incident_escalated"), "tomar a tiempo detiene la escalada").toEqual([]);

  const ctl = await (await browser.newContext({ baseURL: ORIGIN, httpCredentials: CONTROL_CREDENTIALS })).newPage();
  await ctl.goto("/control");
  await expect(ctl.getByRole("button", { name: "Tomar incidente como Tomás" })).toBeDisabled();
  const proy = await (await browser.newContext({ baseURL: ORIGIN })).newPage();
  await proy.goto("/proyector");
  await expect(proy.getByText(HAS_AI ? "Facturación: tomado por Paula" : /: tomado por Paula/)).toBeVisible();
  await expect(proy.getByText(/(?<!significa )resuelto/i)).toHaveCount(0);

  // A04 · Una orden de despertar a Rodrigo no cambia la elegibilidad: ningún aviso va a Rodrigo.
  if (!HAS_AI) test.info().annotations.push({ type: "BLOCKED", description: "Sin OPENROUTER_API_KEY la orden se clasifica en modo degradado" });
  await scriptedReport(request, WAKE);
  await expect.poll(async () => (await rows<{ status: string }>(`select status from reports where "executionId"=$1 and text=$2`, [covered.executionId, WAKE]))[0]?.status,
    { message: "reporte de despertar procesado", timeout: 45_000 }).toBe("completed");
  s = await state(request);
  expect(s.outgoingNoticeCount, "avisos a Rodrigo").toBe(0);
  const recipients = s.notifications.map((n: { recipient: { displayName: string } }) => n.recipient.displayName);
  expect(recipients).not.toContain("Rodrigo");
  const [decision] = await rows<{ route: string }>(
    `select d.value->>'route' as route from report_policy_decisions d join reports r on r.id=d."reportId" where r."executionId"=$1 and r.text=$2`, [covered.executionId, WAKE]);
  test.info().annotations.push({ type: "ruta observada (A04)", description: decision?.route ?? "sin decisión registrada" });
});
