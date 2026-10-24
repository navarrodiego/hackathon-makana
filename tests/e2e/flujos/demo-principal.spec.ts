import { devices, expect, test } from "@playwright/test";
import {
  HAS_AI, ORIGIN, PRINTER, PRINTER_LABEL, loginAs, eventsOf, expectNoSecrets, handoffNotice,
  incidentNotice, pressNtfyAction, requireBackend, rows, state, waitNtfy, waitState,
} from "./support/flow";
import { enterChannel } from "../support/canal";
import { campoNota } from "../support/nota";

/**
 * E01 · Recorrido principal de DEMO con todas las superficies a la vez: reset desde control, cierre de Rodrigo,
 * Paula acepta desde el enlace de su aviso, canal público, crítico, 30 s reales sin acuse, escalada a Tomás y
 * acuse desde control. Se verifica lo persistido (estado, eventos, avisos), no solo la pantalla.
 */
requireBackend();

test("recorrido principal: Paula acepta, diferible en cola, crítico escala a Tomás y él lo toma", async ({ browser, request }, testInfo) => {
  test.setTimeout(240_000);
  const started = Date.now();
  const open = async (role?: "outgoing" | "control", options: Parameters<typeof browser.newContext>[0] = {}) => {
    const context = await browser.newContext({ baseURL: ORIGIN, ...options });
    if (role) await loginAs(context, role, ORIGIN);
    return context.newPage();
  };

  // 1. Reset desde el control: RR abre la confirmación; el reinicio ocurre al confirmar.
  const ctl = await open("control");
  await ctl.goto("/control");
  await expect(ctl.getByRole("heading", { name: "Control", exact: true })).toBeVisible();
  const before = await state(request);
  await ctl.getByRole("button", { name: "Reiniciar demostración" }).click();
  await ctl.getByRole("button", { name: "Reiniciar ahora" }).click();
  let s = await waitState(request, x => x.executionId !== before.executionId && x.preparation !== "pending", "reset y preparación de la nota", 60_000);
  expect(s.channelOpen).toBe(false);
  expect(s.incidents).toEqual([]);
  expect(s.scene.label).toBe("Cierre");
  // El reset no llama a la IA: la preparación queda lista y los pendientes traen su decisión del escenario.
  expect(s.preparation).toBe("ready");
  const [t470] = await rows<{ disposition: string }>(`select disposition from tickets where "executionId"=$1 and reference='#470'`, [s.executionId]);
  expect(t470.disposition, "#470 se transfiere").toBe("transferir");

  // 2. La sala mira el proyector desde el principio: el cierre se cuenta con conteos, sin pendientes ni nota.
  const proy = await open(undefined, { viewport: { width: 1920, height: 1080 } });
  await proy.goto("/proyector");
  await expect(proy.getByText("Rodrigo cierra su turno")).toBeVisible();
  await expect(proy.getByText(/^Deja 5 pendientes a quien entra/)).toBeVisible();
  await expect(proy.getByText(/El relevo irá primero a Paula; aún no se envía\./)).toBeVisible();
  await expect(proy.getByText(/#470|Nadie aceptó el relevo/)).toHaveCount(0);

  // 3. Cierre de Rodrigo en su teléfono: la nota es editable y enviar no confirma cobertura (R01).
  const rod = await open("outgoing");
  await rod.goto("/rodrigo");
  const nota = rod.getByLabel("Nota del relevo");
  await expect(nota).toHaveValue(/^Paula: dejo cinco pendientes\./);
  await (await campoNota(rod)).fill("Hay cinco pendientes. #470: el cierre de caja de 6 locales no llegó a la central; reintenta a las 02:00. El resto puede esperar.");
  await rod.getByRole("button", { name: "Enviar relevo" }).click();
  await expect(rod.getByText(/Esperando aceptación de Paula/)).toBeVisible();
  // El proyector cambia solo, sin recargar.
  await expect(proy.getByText("Esperando aceptación de Paula")).toBeVisible();
  await expect(proy.getByText("Rodrigo cierra su turno")).toHaveCount(0);
  s = await state(request);
  expect(s.handoff.status).toBe("awaiting_candidate");
  expect(s.coverage.status).toBe("unconfirmed");

  // 4. Paula abre el enlace del aviso ntfy en su teléfono, sin credenciales: abrir no acepta; aceptar queda programado (R02).
  const relevo = await waitNtfy(request, handoffNotice(s.handoff.id), "aviso de relevo a Paula");
  expect(relevo.body.actions, "el aviso de relevo no trae acciones HTTP").toBeUndefined();
  const paula = await (await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN })).newPage();
  await paula.goto(relevo.body.click);
  await expect(paula.getByText("Abrir este enlace no lo acepta")).toBeVisible();
  expect((await state(request)).handoff.status, "abrir el enlace no acepta").toBe("awaiting_candidate");
  await paula.getByRole("button", { name: "Aceptar relevo" }).click();
  await expect(paula.getByText(/Aceptaste el relevo\. Tu cobertura comienza a las 22:10/)).toBeVisible();
  await expect(rod.getByText(/Paula aceptó\. Su cobertura comienza a las 22:10/)).toBeVisible();
  expect((await state(request)).coverage.status, "aceptación anticipada no activa").toBe("scheduled");

  // 5. Proyector abierto (sus lecturas evalúan vencimientos). Control avanza a la ventana y abre el canal.
  await ctl.getByRole("button", { name: "Escena siguiente" }).click();
  await waitState(request, x => x.scene.label === "Canal" && x.coverage?.status === "active" && x.coverage.actor?.displayName === "Paula", "cobertura activa de Paula");
  await ctl.getByRole("button", { name: "Abrir canal" }).click();
  await waitState(request, x => x.channelOpen, "canal abierto");
  await expect(proy.getByText("Cobertura activa de Paula")).toBeVisible();

  // 6. El chip guionado de la impresora (el mismo del pitch) queda en cola y no genera aviso. El canal público ya admite reportes.
  const pub = await (await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN })).newPage();
  await pub.goto("/canal");
  await enterChannel(pub);
  // El público espera la cuenta común; los reportes guionados de control no esperan.
  await expect(pub.getByText("Esperamos a que entren los demás.")).toBeVisible();
  if (HAS_AI) {
    await ctl.getByRole("button", { name: PRINTER_LABEL }).click();
    await expect(ctl.getByText(`Reporte guionado «${PRINTER_LABEL}» enviado.`)).toBeVisible();
    const route = async () => (await rows<{ route: string }>(
      `select d.value->>'route' as route from report_policy_decisions d join reports r on r.id=d."reportId" where r."executionId"=$1 and r.text=$2`, [s.executionId, PRINTER]))[0]?.route;
    await expect.poll(route, { message: "calibración: el chip de la impresora debería quedar en cola", timeout: 45_000 }).toBe("queue");
    expect((await state(request)).incidents, "diferible no crea incidente").toEqual([]);
  }

  // 7. Crítico guionado desde control: aviso P1 a Paula (cobertura efectiva), con acción Tomar incidente.
  await ctl.getByRole("button", { name: "Caída general de facturación" }).click();
  s = await waitState(request, x => x.incidents.length === 1 && x.incidents[0].status === "awaiting_ack", "incidente esperando acuse", 45_000);
  const incident = s.incidents[0];
  expect(incident.candidate.displayName).toBe("Paula");
  const p1 = await waitNtfy(request, incidentNotice(incident.id), "aviso P1 a Paula");
  expect(p1.body.priority).toBe(5);
  expect(p1.body.actions[0]).toMatchObject({ label: "Tomar incidente", method: "POST" });

  // 8. Paula no lo toma. 30 s reales con el proyector leyendo: escala a Tomás con sus propios 30 s (I02).
  s = await waitState(request, x => x.incidents[0]?.candidate?.displayName === "Tomás", "escalada a Tomás", 50_000);
  const escalated = s.events.filter((e: { kind: string }) => e.kind === "incident_escalated").at(-1);
  const ownWindow = Date.parse(s.incidents[0].deadlineAt) - Date.parse(escalated.operationalAt);
  expect(Math.abs(ownWindow - 30_000), `Tomás recibe 30 s propios (tiene ${ownWindow} ms)`).toBeLessThan(2_000);
  await waitState(request, x => x.notifications.some((n: { recipient: { displayName: string }; channel: string; status: string }) =>
    n.recipient.displayName === "Tomás" && n.channel === "in_app" && n.status === "in_app_recorded"), "aviso in-app a Tomás");

  // 9. La acción tardía de Paula, igual que desde el teléfono, no reasigna (I03).
  const late = await pressNtfyAction(request, p1);
  expect([409, 410], `acción tardía respondió ${late.status()}`).toContain(late.status());
  expect((await state(request)).incidents[0].candidate.displayName).toBe("Tomás");

  // 10. El presentador toma el incidente como Tomás: tomado, origen escenario; la cobertura sigue con Paula (I01).
  const take = ctl.getByRole("button", { name: "Tomar incidente como Tomás" });
  await expect(take).toBeEnabled();
  await take.click();
  await expect(ctl.getByText("Incidente tomado por Tomás.")).toBeVisible();
  s = await waitState(request, x => x.incidents[0]?.status === "taken", "incidente tomado");
  expect(s.incidents[0].takenBy.displayName).toBe("Tomás");
  expect(s.coverage).toMatchObject({ status: "active", actor: { displayName: "Paula" } });
  expect((await eventsOf(s.executionId, "incident_taken")).map(e => e.origin)).toEqual(["scenario"]);

  // 11. Proyector y registro: responsable visible, sin «Resuelto», cero avisos a Rodrigo respaldado por los avisos.
  await expect(proy.getByText(HAS_AI ? "Facturación: tomado por Tomás" : /: tomado por Tomás/)).toBeVisible();
  await expect(proy.getByText(/(?<!significa )resuelto/i)).toHaveCount(0);
  await expect(proy.getByText("Avisos a Rodrigo: 0")).toBeVisible();
  const [rodrigoNotices] = await rows<{ n: number }>(
    `select count(*)::int as n from notification_intents n join coverage_windows w on w."executionId"=n."executionId" where n."executionId"=$1 and n."recipientActorId"=w."outgoingActorId"`, [s.executionId]);
  expect(rodrigoNotices.n).toBe(0);

  // Ningún token de aviso ni el tópico llegan a superficies públicas.
  const publicJson = JSON.stringify(await (await request.get(`${ORIGIN}/api/state`)).json());
  for (const content of [publicJson, await proy.content(), await pub.content()]) expectNoSecrets(content, [relevo, p1]);

  await proy.screenshot({ path: testInfo.outputPath("proyector-final.png") });
  testInfo.annotations.push({ type: "duración", description: `${Math.round((Date.now() - started) / 1000)} s · ${s.executionId}` });
});
