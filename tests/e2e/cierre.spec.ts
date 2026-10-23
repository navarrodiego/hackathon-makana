import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Cierre de Rodrigo contra el backend real local. Requiere, en el entorno del proceso: DATABASE_URL (o `.env`),
 * APP_ORIGIN igual al origen del servidor, RODRIGO_* y CONTROL_*. Los tests comparten una base: ejecutar con `--workers=1`.
 * La nota guardada se inserta como fixture (no es una llamada en vivo a la IA); Regenerar con éxito requiere clave del proveedor.
 */
try { process.loadEnvFile(".env"); } catch { /* sin .env: se usa el entorno del proceso */ }

const env = process.env;
const configured = Boolean(env.DATABASE_URL && env.APP_ORIGIN && env.RODRIGO_USERNAME && env.RODRIGO_SECRET && env.CONTROL_USERNAME && env.CONTROL_SECRET);
const basic = (u?: string, s?: string) => `Basic ${Buffer.from(`${u}:${s}`).toString("base64")}`;
const CONTROL = { Authorization: basic(env.CONTROL_USERNAME, env.CONTROL_SECRET), Origin: env.APP_ORIGIN ?? "", "Content-Type": "application/json" };

test.use({ httpCredentials: { username: env.RODRIGO_USERNAME ?? "", password: env.RODRIGO_SECRET ?? "" } });
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
// DIRECT_URL: el rol de la app ya ocupa su límite de conexiones con el servidor.
const psql = (sql: string) => execFileSync("psql", [env.DIRECT_URL ?? env.DATABASE_URL!, "-At", "-F", "|", "-c", sql], { encoding: "utf8" }).trim();

/** Reinicia la ejecución por la ruta de control y espera a que termine la preparación de la nota (sin proveedor: failed). */
async function resetExecution(request: APIRequestContext): Promise<Json> {
  const before = await state(request);
  const reset = await control(request, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });
  expect(reset.status).toBe(201);
  await expect.poll(async () => (await state(request)).preparation, { timeout: 20_000 }).not.toBe("pending");
  return state(request);
}

/** Guarda una sugerencia fixture como lo haría la preparación: nota en el relevo, versión +1 y preparación lista. */
function seedSavedSuggestion(executionId: string, handoffId: string) {
  const rows = psql(`select t.id, t.reference from tickets t join handoffs h on t.id = any(h."ticketIds") where h.id='${handoffId}' order by t.reference desc`)
    .split("\n").map(line => line.split("|"));
  const suggestions = rows.map(([ticketId, reference]) => ({
    ticketId, disposition: reference === "#470" ? "transferir" : "puede_esperar",
    reason: reference === "#470" ? "El próximo intento del respaldo es a las 02:00." : "Puede esperar a la próxima atención.",
  }));
  const current = Number(psql(`select version from handoffs where id='${handoffId}'`));
  const saved = {
    executionId, version: current + 1,
    output: { suggestions, note: "Hay cinco pendientes. #470 queda para seguimiento: el próximo intento del respaldo es a las 02:00. El resto puede esperar." },
    provenance: { provider: "openrouter", api: "structured_chat", model: "fixture-e2e", configurationId: "fixture-e2e" },
    generatedAt: new Date().toISOString(),
  };
  psql(`update handoffs set "savedSuggestion"='${JSON.stringify(saved).replace(/'/g, "''")}'::jsonb, version=version+1 where id='${handoffId}'`);
  psql(`update executions set preparation='ready' where "executionId"='${executionId}'`);
}

async function freshReady(request: APIRequestContext): Promise<Json> {
  const s = await resetExecution(request);
  seedSavedSuggestion(s.executionId, s.handoff.id);
  return state(request);
}
async function openCierre(page: Page) {
  await page.goto("/rodrigo");
  await expect(page.getByRole("heading", { name: "Cierre de turno", level: 1 })).toBeVisible();
}
const sendButton = (page: Page) => page.getByRole("button", { name: "Enviar relevo" });
const noScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("sin credencial el navegador recibe el desafío Basic y una credencial errónea no muestra pendientes", async ({ browser }) => {
  // fetch de Node: sin las credenciales por defecto del contexto de Playwright.
  const anonymous = await fetch(`${env.APP_ORIGIN}/rodrigo`);
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("www-authenticate")).toMatch(/^Basic/);
  // Una credencial errónea vuelve a recibir el desafío, para que el navegador pida otra en vez de reenviarla.
  const context = await browser.newContext({ baseURL: env.APP_ORIGIN, httpCredentials: { username: "rodrigo", password: "incorrecta" } });
  const page = await context.newPage();
  const response = await page.goto("/rodrigo");
  expect(response?.status()).toBe(401);
  expect(response?.headers()["www-authenticate"]).toMatch(/^Basic/);
  await expect(page.getByText("#481")).toHaveCount(0);
  await context.close();
});

test("muestra los cinco pendientes, destaca solo el de seguimiento y no afirma cobertura", async ({ page, request }, testInfo) => {
  await freshReady(request);
  await openCierre(page);
  for (const ref of ["#481", "#477", "#470", "#466", "#462"]) await expect(page.getByRole("list", { name: "Pendientes del turno" }).getByText(ref, { exact: true })).toBeVisible();
  const lista = page.getByRole("list", { name: "Pendientes del turno" });
  await expect(lista.getByText("Para seguimiento.")).toHaveCount(1);
  await expect(lista.getByRole("listitem").filter({ hasText: "#470" }).getByText("Para seguimiento.")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText(/Borrador de IA · puedes enviarla tal cual/)).toBeVisible();
  await expect(page.getByLabel("Nota del relevo")).toHaveValue(/Hay cinco pendientes/);
  await expect(page.getByText(/Cobertura activa|Programado|Esperando aceptación/)).toHaveCount(0);
  expect(await noScroll(page)).toBe(true);
  await page.screenshot({ path: `.impeccable/review/cierre-borrador-${testInfo.project.name}.png`, fullPage: true });
});

test("pasar de 60 palabras bloquea el envío con un error vinculado", async ({ page, request }) => {
  await freshReady(request);
  await openCierre(page);
  const note = page.getByLabel("Nota del relevo");
  await note.fill(Array.from({ length: 61 }, (_, i) => `palabra${i}`).join(" "));
  await expect(page.getByText(/La nota tiene 61 palabras/)).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "true");
  await sendButton(page).click();
  await expect(page.getByText("Acorta la nota antes de enviar.")).toBeVisible();
  expect((await state(request)).handoff.status).toBe("draft");
});

test("Regenerar sin proveedor muestra el fallo y conserva el borrador editado", async ({ page, request }) => {
  test.skip(Boolean(env.OPENROUTER_API_KEY), "El servidor tiene clave del proveedor: este caso exige que falle");
  await freshReady(request);
  await openCierre(page);
  const note = page.getByLabel("Nota del relevo");
  await note.fill("Mi nota editada a mano.");
  await page.getByRole("button", { name: "Regenerar" }).click();
  await expect(page.getByRole("alert").getByText(/No se pudo generar la nota/)).toBeVisible();
  await expect(note).toHaveValue("Mi nota editada a mano.");
  await expect(page.getByRole("button", { name: "Regenerar" })).toBeEnabled();
});

test("sin nota guardada avisa que no se generó y deja escribirla", async ({ page, request }) => {
  await resetExecution(request);
  await openCierre(page);
  await expect(page.getByText("La nota no se generó")).toBeVisible();
  await page.getByLabel("Nota del relevo").fill("Nota escrita por Rodrigo.");
  await expect(sendButton(page)).toBeEnabled();
});

test("la nota es opcional: se puede enviar el relevo con la nota vacía", async ({ page, request }) => {
  await freshReady(request);
  await openCierre(page);
  await page.getByLabel("Nota del relevo").fill("");
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
