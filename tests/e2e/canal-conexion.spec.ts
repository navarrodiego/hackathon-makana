import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { OPERATOR_SECRET, basicAs } from "./support/acceso";

config({ quiet: true });

/**
 * Canal público con red mala: respuesta perdida, recarga, red caída y red colgada. Mismo servidor y base que
 * canal.spec.ts. Corre en serie porque cada prueba reinicia la ejecución.
 */
const basic = basicAs("control");
test.describe.configure({ mode: "serial" });
test.skip(!OPERATOR_SECRET || !process.env.APP_ORIGIN, "Faltan APP_ORIGIN y las credenciales de control descartables");

async function sceneId(label: string): Promise<string> {
  const db = new Client({ connectionString: process.env.DIRECT_URL });
  await db.connect();
  try {
    const rows = await db.query(`SELECT id FROM scenes WHERE label=$1 AND "executionId"=(SELECT "executionId" FROM executions WHERE status='active')`, [label]);
    return rows.rows[0].id as string;
  } finally { await db.end(); }
}
async function command(request: APIRequestContext, baseURL: string, path: string, body: Record<string, unknown>) {
  const response = await request.post(`${baseURL}${path}`, { headers: { authorization: basic, origin: baseURL }, data: { idempotencyKey: `e2e-${crypto.randomUUID()}`, ...body } });
  expect(response.status(), await response.text()).toBeLessThan(300);
}
async function state(request: APIRequestContext, baseURL: string) {
  return (await (await request.get(`${baseURL}/api/state`)).json()).data as { executionId: string; version: number };
}
/** Ejecución nueva con el canal abierto y la página del canal lista para escribir. */
async function openChannel(page: Page, request: APIRequestContext, origin: string) {
  const before = await state(request, origin);
  await command(request, origin, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });
  const now = await state(request, origin);
  await command(request, origin, "/api/scene", { executionId: now.executionId, expectedVersion: now.version, sceneId: await sceneId("Canal"), channelOpen: true });
  await page.goto("/canal");
  await expect(page.getByRole("textbox", { name: "Reporte" })).toBeEnabled({ timeout: 15_000 });
}

test("respuesta perdida: se conserva el texto y el reenvío deja un solo reporte", async ({ page, request, baseURL }) => {
  await openChannel(page, request, baseURL!);
  // La primera petición llega al servidor, pero su respuesta no vuelve al teléfono.
  let dropped = false;
  await page.route("**/api/messages", async route => {
    if (dropped) return route.continue();
    dropped = true;
    await route.fetch();
    await route.abort("internetdisconnected");
  });
  await page.getByRole("textbox", { name: "Apodo" }).fill("Visita");
  await page.getByRole("textbox", { name: "Reporte" }).fill("Local 7: caja 2 no emite boletas");
  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText("No se pudo comprobar si el reporte quedó registrado")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reporte" })).toHaveValue("Local 7: caja 2 no emite boletas");

  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByTestId("canal-resultado")).toHaveText("Reporte registrado. Su estado aparece en Tus reportes.");
  await expect(page.getByText(/^Reporte 1:/)).toBeVisible();
  await expect(page.getByText(/^Reporte 2:/)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Reporte" })).toHaveValue("");
});

test("recargar la página no pierde el borrador", async ({ page, request, baseURL }) => {
  await openChannel(page, request, baseURL!);
  await page.getByRole("textbox", { name: "Apodo" }).fill("Visita");
  await page.getByRole("textbox", { name: "Reporte" }).fill("VPN lenta en el local 3");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Reporte" })).toHaveValue("VPN lenta en el local 3");
  await expect(page.getByRole("textbox", { name: "Apodo" })).toHaveValue("Visita");
});

test("sin red: aviso de conexión, texto conservado y vuelta sola al recuperarla", async ({ page, context, request, baseURL }) => {
  await openChannel(page, request, baseURL!);
  await page.getByRole("textbox", { name: "Reporte" }).fill("Impresora sin tóner");
  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión desde las/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Reporte" })).toHaveValue("Impresora sin tóner");
  await context.setOffline(false);
  await expect(page.getByText(/Sin conexión desde las/)).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("textbox", { name: "Reporte" })).toHaveValue("Impresora sin tóner");
});

test("una consulta de estado colgada se muestra como sin conexión, no como al día", async ({ page, request, baseURL }) => {
  await openChannel(page, request, baseURL!);
  // El servidor nunca responde: sin plazo, la pestaña seguiría esperando sin avisar.
  await page.route("**/api/state", () => {});
  await expect(page.getByText(/Sin conexión desde las/)).toBeVisible({ timeout: 20_000 });
  await page.unroute("**/api/state");
  await expect(page.getByText(/Sin conexión desde las/)).toBeHidden({ timeout: 25_000 });
});
