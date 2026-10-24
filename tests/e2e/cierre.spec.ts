import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { basicAs, loginAs } from "./support/acceso";
import { campoNota } from "./support/nota";

/**
 * Cierre de Rodrigo contra el backend real local. Requiere, en el entorno del proceso: DATABASE_URL (o `.env`),
 * APP_ORIGIN igual al origen del servidor, OPERATOR_SECRET. Los tests comparten una base: ejecutar con `--workers=1`.
 * El cierre no usa IA: los pendientes y el resumen de traspaso son fijos en el código.
 */
try { process.loadEnvFile(".env"); } catch { /* sin .env: se usa el entorno del proceso */ }

const env = process.env;
const configured = Boolean(env.DATABASE_URL && env.APP_ORIGIN && env.OPERATOR_SECRET);
const CONTROL = { Authorization: basicAs("control"), Origin: env.APP_ORIGIN ?? "", "Content-Type": "application/json" };

test.beforeEach(async ({ context }) => { await loginAs(context, "outgoing", env.APP_ORIGIN!); });
test.describe.configure({ mode: "serial" });
test.skip(!configured, "BLOCKED: faltan variables de entorno del backend local");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function state(request: APIRequestContext): Promise<Json> {
  return (await (await request.get("/api/state")).json()).data;
}
async function control(request: APIRequestContext, path: string, body: Json) {
  const response = await request.post(path, { headers: CONTROL, data: { idempotencyKey: randomUUID(), ...body } });
  return { status: response.status(), body: await response.json() };
}
/** Reinicia la ejecución por la ruta de control y espera a que la preparación quede lista (sin IA). */
async function resetExecution(request: APIRequestContext): Promise<Json> {
  const before = await state(request);
  const reset = await control(request, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });
  expect(reset.status).toBe(201);
  await expect.poll(async () => (await state(request)).preparation, { timeout: 20_000 }).toBe("ready");
  return state(request);
}

const freshReady = resetExecution;
async function openCierre(page: Page) {
  await page.goto("/rodrigo");
  await expect(page.getByRole("heading", { name: "Cierre de turno", level: 1 })).toBeVisible();
}
const sendButton = (page: Page) => page.getByRole("button", { name: "Enviar relevo" });
const noScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("ingreso: contraseña errónea se corrige sin recargar, abre el cierre y cerrar sesión vuelve al ingreso", async ({ browser }) => {
  // Contexto propio, sin la sesión que el beforeEach deja en `page`.
  const context = await browser.newContext({ baseURL: env.APP_ORIGIN });
  const page = await context.newPage();
  await page.goto("/rodrigo");
  await expect(page.getByText("#481")).toHaveCount(0);
  const password = page.getByLabel("Contraseña de operador");
  await password.fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar al cierre de turno" }).click();
  await expect(page.getByText("La contraseña no coincide. Revísala y vuelve a intentarlo.")).toBeVisible();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await password.fill(env.OPERATOR_SECRET!);
  await page.getByRole("button", { name: "Ingresar al cierre de turno" }).click();
  await expect(page.getByRole("list", { name: "Pendientes del turno" })).toBeVisible();
  const cookies = await context.cookies();
  const session = cookies.find(c => c.name === "relevo_op_rodrigo");
  expect(session?.httpOnly).toBe(true);
  expect(session?.value).not.toContain(env.OPERATOR_SECRET!);
  // La sesión de Rodrigo no abre control: pide ingresar a control, en el mismo navegador.
  await page.goto("/control");
  await expect(page.getByText("Tu sesión actual es del cierre de turno y no abre control.", { exact: false })).toBeVisible();
  await page.getByLabel("Contraseña de operador").fill(env.OPERATOR_SECRET!);
  await page.getByRole("button", { name: "Ingresar a control" }).click();
  await expect(page.getByRole("heading", { name: "Escenas" })).toBeVisible();
  // Ambas sesiones conviven: el cierre sigue abierto.
  await page.goto("/rodrigo");
  await expect(page.getByRole("list", { name: "Pendientes del turno" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Contraseña de operador")).toBeVisible();
  await expect(page.getByText("#481")).toHaveCount(0);
  await context.close();
});

test("ingreso sin JavaScript: el formulario hace POST, la contraseña no queda en la URL y el error se muestra", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: env.APP_ORIGIN, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/rodrigo");
  await page.getByLabel("Contraseña de operador").fill("incorrecta-123");
  await page.getByRole("button", { name: "Ingresar al cierre de turno" }).click();
  await expect(page.getByText("La contraseña no coincide. Revísala y vuelve a intentarlo.")).toBeVisible();
  expect(page.url()).not.toContain("incorrecta");
  await page.getByLabel("Contraseña de operador").fill(env.OPERATOR_SECRET!);
  await page.getByRole("button", { name: "Ingresar al cierre de turno" }).click();
  await expect(page.getByRole("list", { name: "Pendientes del turno" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/rodrigo");
  expect(page.url()).not.toContain(env.OPERATOR_SECRET!);
  await context.close();
});

test("muestra los cinco pendientes, destaca solo el de seguimiento y no afirma cobertura", async ({ page, request }, testInfo) => {
  await freshReady(request);
  await openCierre(page);
  for (const ref of ["#481", "#477", "#470", "#466", "#462"]) await expect(page.getByRole("list", { name: "Pendientes del turno" }).getByText(ref, { exact: true })).toBeVisible();
  const lista = page.getByRole("list", { name: "Pendientes del turno" });
  await expect(lista.getByText("Para seguimiento.")).toHaveCount(1);
  const t470 = lista.getByRole("listitem").filter({ hasText: "#470" });
  await expect(t470.getByText("Para seguimiento.")).toBeVisible();
  await expect(t470.getByText(/El cierre de caja de 6 locales no llegó a la central/)).toBeVisible();
  await expect(t470.getByText(/Revisa si el reintento de las 02:00 funcionó\./)).toBeVisible();
  await expect(page.getByText("Solo #470 queda para seguimiento; eso no lo vuelve urgente.")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText(/Resumen del turno · puedes enviarlo tal cual/)).toBeVisible();
  await expect(page.getByLabel("Nota del relevo")).toHaveValue(/^Paula: dejo cinco pendientes\. Solo el #470 necesita seguimiento/);
  await expect(page.getByText(/Cobertura activa|Programado|Esperando aceptación/)).toHaveCount(0);
  expect(await noScroll(page)).toBe(true);
  await page.screenshot({ path: `.impeccable/review/cierre-borrador-${testInfo.project.name}.png`, fullPage: true });
});

test("pasar de 60 palabras bloquea el envío con un error vinculado", async ({ page, request }) => {
  await freshReady(request);
  await openCierre(page);
  const note = await campoNota(page);
  await note.fill(Array.from({ length: 61 }, (_, i) => `palabra${i}`).join(" "));
  await expect(page.getByText(/La nota tiene 61 palabras/)).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "true");
  await sendButton(page).click();
  await expect(page.getByText("Acorta la nota antes de enviar.")).toBeVisible();
  expect((await state(request)).handoff.status).toBe("draft");
});

test("el cierre no usa IA: sin Regenerar, sin avisos de preparación y con el resumen fijo", async ({ page, request }) => {
  await resetExecution(request);
  await openCierre(page);
  await campoNota(page);
  await expect(page.getByRole("button", { name: "Regenerar" })).toHaveCount(0);
  await expect(page.getByText(/\bIA\b/)).toHaveCount(0);
  await expect(page.getByText(/La nota aún se está preparando|La nota no se generó/)).toHaveCount(0);
  await expect(page.getByLabel("Nota del relevo")).toHaveValue(/ninguno detiene las ventas\.$/);
  await expect(sendButton(page)).toBeEnabled();
});

test("la nota es opcional: se puede enviar el relevo con la nota vacía", async ({ page, request }) => {
  await freshReady(request);
  await openCierre(page);
  await (await campoNota(page)).fill("");
  await sendButton(page).click();
  await expect(page.getByText(/Esperando aceptación de/)).toBeVisible();
  expect((await state(request)).handoff.status).toBe("awaiting_candidate");
});

test("enviar muestra espera de aceptación, bloquea la edición y no reaviza incidentes", async ({ page, request }, testInfo) => {
  const before = await freshReady(request);
  await openCierre(page);
  await sendButton(page).click();
  await expect(page.getByText(/Esperando aceptación de/)).toBeVisible();
  await expect(page.getByText(/Cobertura activa|Programado/)).toHaveCount(0);
  await expect(sendButton(page)).toHaveCount(0);
  await expect(page.getByLabel("Nota del relevo")).toBeDisabled();
  // El estado del relevo manda: pendientes y nota quedan plegados bajo «Lo que dejaste».
  await expect(page.getByRole("heading", { name: "Estado del relevo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pendientes que dejas" })).toBeHidden();
  await expect(page.getByText(/^Lo que dejaste: 5 pendientes y una nota$/)).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/cierre-enviado-${testInfo.project.name}.png`, fullPage: true });
  const after = await state(request);
  expect(after.handoff.status).toBe("awaiting_candidate");
  expect(after.events.filter((e: Json) => e.kind.startsWith("incident_"))).toEqual([]);
  expect(after.outgoingNoticeCount).toBe(before.outgoingNoticeCount);
});

test("un fallo de red al enviar se puede reintentar sin duplicar el relevo", async ({ page, request }) => {
  await freshReady(request);
  await openCierre(page);
  let first = true;
  await page.route("**/api/handoff", async route => {
    if (first) { first = false; await route.fetch(); await route.abort("failed"); } else await route.continue();
  });
  await sendButton(page).click();
  await expect(page.getByText(/No se pudo comprobar si el relevo se envió/)).toBeVisible();
  await sendButton(page).click();
  await expect(page.getByText(/Esperando aceptación de/)).toBeVisible();
  const events = (await state(request)).events.filter((e: Json) => e.kind === "handoff_sent");
  expect(events).toHaveLength(1);
});

test("una aceptación anticipada queda programada con la hora de inicio, sin cobertura activa", async ({ page, request }, testInfo) => {
  const ready = await freshReady(request);
  await openCierre(page);
  await sendButton(page).click();
  await expect(page.getByText(/Esperando aceptación de/)).toBeVisible();
  // Vuelve a la escena de cierre justo antes de aceptar: la hora narrativa queda 10 s antes del inicio de la ventana.
  const sent = await state(request);
  const closing = sent.scene.id;
  const scene = await control(request, "/api/scene", { executionId: sent.executionId, expectedVersion: sent.version, sceneId: closing, channelOpen: false });
  expect(scene.status).toBe(200);
  const fresh = await state(request);
  const accepted = await control(request, `/api/handoff/${fresh.handoff.id}/accept`, {
    executionId: fresh.executionId, expectedVersion: fresh.handoff.version, attemptId: fresh.handoff.attemptId, representedActorId: fresh.handoff.candidate.id,
  });
  expect(accepted.status).toBe(200);
  const name = fresh.handoff.candidate.displayName;
  await expect(page.getByText(new RegExp(`${name} aceptó. Su cobertura comienza a las 22:10`))).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/Cobertura activa de/)).toHaveCount(0);
  await expect(page.getByText("Tu turno termina")).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/cierre-programado-${testInfo.project.name}.png`, fullPage: true });
  expect(ready.handoff.status).toBe("draft");
});

test("si el candidato no responde, el relevo se deriva y se avisa que no hay que reenviar", async ({ page, request }) => {
  test.setTimeout(90_000);
  await freshReady(request);
  await openCierre(page);
  await sendButton(page).click();
  await expect(page.getByText(/Esperando aceptación de/)).toBeVisible();
  await expect(page.getByText(/Relevo enviado a .+; no necesitas reenviarlo\./)).toBeVisible({ timeout: 45_000 });
});
