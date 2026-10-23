import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Fases de /rodrigo (cierre, seguimiento y resumen de la noche) contra el backend real local. Requiere, en el entorno del proceso: DATABASE_URL (o `.env`),
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

/** Reinicia la ejecución por la ruta de control y espera a que termine la preparación de la nota (sin proveedor: failed). */
async function resetExecution(request: APIRequestContext): Promise<Json> {
  const before = await state(request);
  const reset = await control(request, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });
  expect(reset.status).toBe(201);
  await expect.poll(async () => (await state(request)).preparation, { timeout: 20_000 }).not.toBe("pending");
  return state(request);
}

const noScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function openCierre(page: Page) {
  await page.goto("/rodrigo");
  await expect(page.getByRole("heading", { name: "Cierre de turno", level: 1 })).toBeVisible();
}
async function sendHandoff(page: Page) {
  await page.getByRole("button", { name: "Enviar relevo" }).click();
  await expect(page.getByText(/Esperando aceptación de/)).toBeVisible();
}
async function toMorning(request: APIRequestContext) {
  const s = await state(request);
  const sceneId = execFileSync("psql", [env.DIRECT_URL ?? env.DATABASE_URL!, "-At", "-c",
    `select id from scenes where "executionId"='${s.executionId}' and label='Registro de mañana'`], { encoding: "utf8" }).trim();
  const scene = await control(request, "/api/scene", { executionId: s.executionId, expectedVersion: s.version, sceneId, channelOpen: false });
  expect(scene.status).toBe(200);
}

test("el cierre muestra solo lo del cierre: sin resumen, registro, consulta ni incidentes vacíos", async ({ page, request }) => {
  await resetExecution(request);
  await openCierre(page);
  await expect(page.getByRole("region", { name: "Resumen de la noche" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Mañana|Registro continuo)$/ })).toHaveCount(0);
  await expect(page.getByText(/roncas fuerte/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Incidentes activos" })).toHaveCount(0);
});

test("tras enviar, el estado del relevo manda y lo entregado queda plegado", async ({ page, request }) => {
  await resetExecution(request);
  await openCierre(page);
  await sendHandoff(page);
  const left = page.getByText(/^Lo que dejaste: 5 pendientes/);
  await expect(left).toBeVisible();
  await expect(page.getByRole("list", { name: "Pendientes del turno" })).toBeHidden();
  await left.click();
  await expect(page.getByRole("list", { name: "Pendientes del turno" })).toBeVisible();
});

test("escena de mañana con relevo enviado: avisos a Rodrigo, sin despertares ni resolución", async ({ page, request }, testInfo) => {
  await resetExecution(request);
  await openCierre(page);
  await sendHandoff(page);
  await toMorning(request);
  await expect(page.getByRole("heading", { name: "Resumen de la noche", level: 1 })).toBeVisible({ timeout: 10_000 });
  const resumen = page.getByRole("region", { name: "Resumen de la noche" });
  await expect(resumen.getByText("Avisos a Rodrigo: 0")).toBeVisible();
  await expect(resumen.getByText("No se registraron incidentes.")).toBeVisible();
  await expect(page.getByText(/Despertares:/i)).toHaveCount(0);
  await expect(page.getByText(/^Resuelto|Problema resuelto/)).toHaveCount(0);
  await expect(page.getByText(/roncas fuerte/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Estado del relevo" })).toHaveCount(0);
  expect(await noScroll(page)).toBe(true);
  await page.screenshot({ path: `.impeccable/review/resumen-noche-${testInfo.project.name}.png`, fullPage: true });
});

test("escena de mañana sin relevo enviado: sigue el cierre, no se inventa resumen", async ({ page, request }) => {
  await resetExecution(request);
  await toMorning(request);
  await openCierre(page);
  await expect(page.getByRole("region", { name: "Resumen de la noche" })).toHaveCount(0);
});

test("tras reset la vista abierta avisa que quedó desactualizada", async ({ page, request }) => {
  await resetExecution(request);
  await openCierre(page);
  await sendHandoff(page);
  await resetExecution(request);
  await expect(page.getByText("Esta vista quedó desactualizada")).toBeVisible({ timeout: 15_000 });
});
