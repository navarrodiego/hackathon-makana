import { devices, expect, test } from "@playwright/test";
import {
  BILLING, ORIGIN, loginAs, acceptAs, handoffNotice, requireBackend, reset, rows, scene, scriptedReport,
  sendHandoff, sinkMessages, state, waitNtfy, waitState, type State,
} from "./support/flow";

/**
 * Ramas de DEMO fuera del pitch (R03–R06, R09): rechazo inmediato, silencio de Paula y de Tomás, respuesta tardía
 * y crítico sin cobertura. Cada rama parte de una ejecución nueva y usa el enlace real del aviso de Paula.
 */
requireBackend();

type Notice = { recipient: { displayName: string }; channel: string; status: string };
const inAppTo = (s: State, name: string) => s.notifications.some((n: Notice) => n.recipient.displayName === name && n.channel === "in_app" && n.status === "in_app_recorded");
const holders = async (executionId: string) =>
  (await rows<{ n: number }>(`select count(*)::int as n from handoff_attempts where "executionId"=$1 and status='accepted'`, [executionId]))[0].n;

test("Paula no puede cubrir: Tomás recibe la solicitud de inmediato y la respuesta tardía de Paula no reasigna (R03/R06)", async ({ browser, request }) => {
  await reset(request);
  const sent = await sendHandoff(request);
  const paulaAttempt = sent.handoff.attemptId;
  const notice = await waitNtfy(request, handoffNotice(sent.handoff.id), "aviso de relevo a Paula");
  const paula = await (await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN })).newPage();
  await paula.goto(notice.body.click);
  await paula.getByRole("button", { name: "No puedo cubrir" }).click();
  await expect(paula.getByText("Indicaste que no puedes cubrir")).toBeVisible();

  const derivedAt = Date.now();
  const s = await waitState(request, x => x.handoff.candidate?.displayName === "Tomás", "derivación a Tomás", 5_000);
  expect(Date.now() - derivedAt, "el rechazo no espera el plazo de Paula").toBeLessThan(5_000);
  const ownWindow = Date.parse(s.handoff.deadlineAt) - Date.now();
  expect(ownWindow, `Tomás tiene su plazo completo (${ownWindow} ms)`).toBeGreaterThan(24_000);
  await waitState(request, x => inAppTo(x, "Tomás"), "aviso in-app a Tomás");

  const rodContext = await browser.newContext({ baseURL: ORIGIN });
  await loginAs(rodContext, "outgoing", ORIGIN);
  const rod = await rodContext.newPage();
  await rod.goto("/rodrigo");
  // Rodrigo ve el candidato vigente sin tener que reenviar nada.
  await expect(rod.getByText("Esperando aceptación de Tomás")).toBeVisible();
  await expect(rod.getByRole("button", { name: "Enviar relevo" })).toHaveCount(0);

  const late = await acceptAs(request, notice, paulaAttempt);
  expect([401, 409, 410], `aceptación tardía respondió ${late.status()}`).toContain(late.status());
  expect((await state(request)).handoff.candidate.displayName).toBe("Tomás");
  expect(await holders(s.executionId), "nadie quedó como titular").toBe(0);
});

test("Paula y Tomás no responden: sin cobertura confirmada, aviso a Carla, turno de Rodrigo sin extender; crítico va a coordinación (R04/R05/R09)", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const fresh = await reset(request);
  const outgoingEndsAt = fresh.coverage.outgoingEndsAt;
  const sent = await sendHandoff(request);
  const paulaAttempt = sent.handoff.attemptId;
  const notice = await waitNtfy(request, handoffNotice(sent.handoff.id), "aviso de relevo a Paula");

  // Paula guarda silencio: al vencer sus 30 s, Tomás recibe 30 s propios (no el resto del primero).
  let s = await waitState(request, x => x.handoff.candidate?.displayName === "Tomás", "derivación a Tomás por silencio", 45_000);
  const derived = s.events.filter((e: { kind: string }) => e.kind === "handoff_derived").at(-1);
  const ownWindow = Date.parse(s.handoff.deadlineAt) - Date.parse(derived.operationalAt);
  expect(Math.abs(ownWindow - 30_000), `Tomás recibe 30 s propios (tiene ${ownWindow} ms)`).toBeLessThan(2_000);

  // Tomás tampoco responde: hueco explícito y coordinación in-app a Carla.
  s = await waitState(request, x => x.handoff.status === "uncovered", "relevo sin cobertura", 45_000);
  expect(s.coverage.status).toBe("unconfirmed");
  expect(s.coverage.outgoingEndsAt, "el fin del turno de Rodrigo no se extiende").toBe(outgoingEndsAt);
  await waitState(request, x => inAppTo(x, "Carla"), "aviso de coordinación a Carla");

  const rodContext = await browser.newContext({ baseURL: ORIGIN });
  await loginAs(rodContext, "outgoing", ORIGIN);
  const rod = await rodContext.newPage();
  await rod.goto("/rodrigo");
  await expect(rod.getByText("Sin cobertura confirmada. Aviso a jefatura registrado en la aplicación.")).toBeVisible();
  await expect(rod.getByText(/descansar/i)).toHaveCount(0);

  const late = await acceptAs(request, notice, paulaAttempt);
  expect([401, 409, 410], `aceptación tardía respondió ${late.status()}`).toContain(late.status());
  expect(await holders(s.executionId)).toBe(0);
  expect((await state(request)).coverage.status).toBe("unconfirmed");

  // Crítico sin cobertura efectiva: sin técnico inventado; coordinación a Carla, nada a Rodrigo ni push.
  await scene(request, "Canal", true);
  const ntfyBefore = (await sinkMessages(request)).length;
  await scriptedReport(request, BILLING);
  s = await waitState(request, x => x.incidents.length === 1, "incidente sin cobertura", 45_000);
  expect(s.incidents[0].status).toBe("unacknowledged");
  expect(s.incidents[0].candidate).toBeNull();
  await waitState(request, x => x.notifications.filter((n: Notice) => n.recipient.displayName === "Carla").length >= 2, "segundo aviso a Carla");
  expect(s.outgoingNoticeCount, "avisos a Rodrigo").toBe(0);
  expect((await sinkMessages(request)).length, "sin push nuevo").toBe(ntfyBefore);
});
