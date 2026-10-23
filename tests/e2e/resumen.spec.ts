import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Resumen y consulta de /rodrigo contra el backend real local. Requiere, en el entorno del proceso: DATABASE_URL (o `.env`),
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
async function openResumen(page: Page) {
  await page.goto("/rodrigo");
  await expect(page.getByRole("heading", { name: "Resumen y registro", level: 2 })).toBeVisible();
}

test("ejecución nueva: sin despertares ni resolución, con consulta sin diagnóstico", async ({ page, request }, testInfo) => {
  await resetExecution(request);
  await openResumen(page);
  await expect(page.getByText("Avisos a Rodrigo")).toBeVisible();
  await expect(page.getByText(/Despertares:/i)).toHaveCount(0);
  await expect(page.getByText(/^Resuelto|Problema resuelto/)).toHaveCount(0);
  const consulta = page.getByRole("region", { name: "Si te dicen que roncas fuerte" });
  await expect(consulta).toContainText("profesional de salud");
  await expect(consulta).toContainText("no diagnostica ni recomienda medicamentos");
  await expect(consulta).not.toContainText(/apnea|melatonina|duerm(e|as) (más|mejor)/i);
  expect(await noScroll(page)).toBe(true);
  await page.screenshot({ path: `.impeccable/review/resumen-vacio-${testInfo.project.name}.png`, fullPage: true });
});

test("Mañana filtra el registro continuo: la escena aparece solo en el continuo", async ({ page, request }, testInfo) => {
  const before = await resetExecution(request);
  const scene = await control(request, "/api/scene", { executionId: before.executionId, expectedVersion: before.version, sceneId: before.scene.id, channelOpen: true });
  expect(scene.status).toBe(200);
  await openResumen(page);
  const morning = page.getByRole("button", { name: "Mañana" });
  const all = page.getByRole("button", { name: "Registro continuo" });
  await expect(morning).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Cambió la escena")).toHaveCount(0);
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Cambió la escena").first()).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/resumen-eventos-${testInfo.project.name}.png`, fullPage: true });
});

test("tras reset la vista abierta avisa de la ejecución nueva y no mezcla su registro", async ({ page, request }) => {
  await resetExecution(request);
  await openResumen(page);
  await resetExecution(request);
  await expect(page.getByText("Se inició una nueva ejecución")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Mañana" })).toHaveCount(0);
});
