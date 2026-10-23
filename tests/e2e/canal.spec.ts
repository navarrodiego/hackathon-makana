import { expect, test, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { OPERATOR_SECRET, basicAs } from "./support/acceso";

config({ quiet: true });

/**
 * Recorrido del canal público contra el servidor real y la base local del worktree.
 * Lee solo el id de escena con DIRECT_URL: el rol de la app ya ocupa su límite de conexiones con el servidor.
 * Necesita APP_ORIGIN igual a la URL de pruebas y OPERATOR_SECRET (contraseña descartable).
 * Sin OPENROUTER_API_KEY la clasificación cae en modo degradado: es la ruta que se verifica aquí, no la IA real.
 */
const basic = basicAs("control");

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
  return (await response.json()).data;
}
async function state(request: APIRequestContext, baseURL: string) {
  return (await (await request.get(`${baseURL}/api/state`)).json()).data as { executionId: string; version: number };
}

test.skip(!OPERATOR_SECRET || !process.env.APP_ORIGIN, "Faltan APP_ORIGIN y las credenciales de control descartables");

test("canal: cerrado, abre sin recargar, recibe reportes propios, escapa HTML y respeta el límite de 5", async ({ page, request, baseURL }) => {
  const origin = baseURL!;
  const before = await state(request, origin);
  await command(request, origin, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });

  const dialogs: string[] = [];
  const errors: string[] = [];
  page.on("dialog", d => { dialogs.push(d.message()); void d.dismiss(); });
  page.on("pageerror", e => errors.push(e.message));

  await page.goto("/canal");
  await expect(page.getByRole("heading", { name: "Canal", exact: true })).toBeVisible();
  await expect(page.getByText("El canal está cerrado por ahora")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reporte" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enviar reporte" })).toBeDisabled();

  // Control abre el canal con la escena real; la página lo detecta sola.
  const now = await state(request, origin);
  await command(request, origin, "/api/scene", { executionId: now.executionId, expectedVersion: now.version, sceneId: await sceneId("Canal"), channelOpen: true });
  await expect(page.getByText("El canal está cerrado por ahora")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Reporte" })).toBeEnabled();

  const send = async (text: string) => {
    await page.getByRole("textbox", { name: "Apodo" }).fill("Visita");
    await page.getByRole("textbox", { name: "Reporte" }).fill(text);
    await page.getByRole("button", { name: "Enviar reporte" }).click();
  };
  const list = page.getByRole("region", { name: "Tus reportes" });

  await send("<img src=x onerror=alert(1)> Local 7: la caja 2 no emite boletas");
  await expect(list.getByText(/^Reporte 1:/)).toBeVisible();
  await expect(list.getByText(/No se pudo clasificar el reporte con certeza/)).toBeVisible();
  expect(await page.locator("img[src='x']").count()).toBe(0);

  // Texto largo: el contador avisa y no se envía.
  await page.getByRole("textbox", { name: "Reporte" }).fill("x".repeat(281));
  await expect(page.getByText("El reporte tiene 281 caracteres. El máximo es 280.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar reporte" })).toBeDisabled();

  for (const n of [2, 3, 4, 5]) {
    await send(`Hecho distinto número ${n} en otro local`);
    await expect(list.getByText(new RegExp(`^Reporte ${n}:`))).toBeVisible();
  }
  await expect(page.getByText("Ya enviaste los 5 reportes de esta sesión.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reporte" })).toBeDisabled();

  // La cookie de sesión no es legible desde la página y el DOM no la contiene.
  expect(await page.evaluate(() => document.cookie)).not.toContain("relevo_session");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `.impeccable/review/canal-${test.info().project.name}.png`, fullPage: true });
});
