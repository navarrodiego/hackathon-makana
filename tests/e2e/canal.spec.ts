import { expect, test, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";
import { OPERATOR_SECRET, basicAs } from "./support/acceso";
import { enterChannel, sendReport } from "./support/canal";

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

test("canal: nombre, espera común sin recargar, reportes propios con texto escapado y límite de 5", async ({ page, request, baseURL }) => {
  test.setTimeout(150_000);
  const origin = baseURL!;
  const before = await state(request, origin);
  await command(request, origin, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });

  const dialogs: string[] = [];
  const errors: string[] = [];
  page.on("dialog", d => { dialogs.push(d.message()); void d.dismiss(); });
  page.on("pageerror", e => errors.push(e.message));

  await page.goto("/canal");
  // El título existe para lectores de pantalla, pero no ocupa espacio en el teléfono.
  await expect(page.locator("header.sr-only").getByRole("heading", { name: "Canal", exact: true })).toHaveCount(1);
  // Primero solo el nombre; el máximo se avisa antes de entrar.
  await page.getByRole("textbox", { name: "Tu nombre" }).fill("x".repeat(41));
  await expect(page.getByText("Tu nombre tiene 41 caracteres. El máximo es 40.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeDisabled();
  await enterChannel(page);
  await expect(page.getByText("El canal abre pronto")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Qué pasó" })).toHaveCount(0);

  // Control abre el canal; la página lo detecta sola y espera la cuenta común (30 s desde la apertura).
  const now = await state(request, origin);
  const opened = await command(request, origin, "/api/scene", { executionId: now.executionId, expectedVersion: now.version, sceneId: await sceneId("Canal"), channelOpen: true });
  expect(opened.channelOpenedAt).toBeTruthy();
  await expect(page.getByText("Esperamos a que entren los demás.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Qué pasó" })).toHaveCount(0);
  // Durante la espera el servidor tampoco admite reportes del público.
  const early = await page.evaluate(async executionId => (await fetch("/api/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-relevo-canal": "1" },
    body: JSON.stringify({ executionId, idempotencyKey: "e2e-espera", nickname: "Visita", text: "Llegó antes" }),
  })).status, opened.executionId);
  expect(early).toBe(409);
  await expect(page.getByRole("heading", { name: "Visita, trabajas en la empresa de Rodrigo" })).toBeVisible({ timeout: 40_000 });
  // El botón de envío cabe en la primera pantalla, sin desplazarse.
  const send = await page.getByRole("button", { name: "Enviar reporte" }).boundingBox();
  expect(send!.y + send!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByRole("button", { name: "Cambiar nombre" })).toHaveCount(0);

  const list = page.getByRole("region", { name: "Tus reportes" });
  const html = "<img src=x onerror=alert(1)> Local 7: la caja 2 no emite boletas";
  await sendReport(page, html);
  await expect(list.getByText(html)).toBeVisible();
  // Sin IA la clasificación es degradada y la facturación pasa a incidente; sin relevo aceptado nadie lo tiene aún.
  // El estado dice a quién le toca, sin texto técnico del proveedor ni de la clasificación.
  await expect(list.getByText("Se trata como urgente hasta revisarlo. Todavía nadie lo toma")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/No se pudo clasificar/)).toHaveCount(0);
  await expect(page.getByText(/ntfy/)).toHaveCount(0);
  expect(await page.locator("img[src='x']").count()).toBe(0);

  // El proyector muestra a la sala el nombre y el texto tal cual (escapado) con su estado; pasada la espera, sin QR.
  const proyector = await page.context().newPage();
  await proyector.goto("/proyector");
  const sala = proyector.getByRole("region", { name: "Reportes de la sala" });
  await expect(sala.getByText(`Visita: ${html}`)).toBeVisible();
  await expect(sala.getByText("Incidente registrado", { exact: true })).toBeVisible();
  await expect(proyector.getByRole("img", { name: /Código QR/ })).toHaveCount(0);
  expect(await proyector.locator("img[src='x']").count()).toBe(0);
  await proyector.close();

  // Texto largo: el contador avisa y no se envía.
  await page.getByRole("textbox", { name: "Qué pasó" }).fill("x".repeat(281));
  await expect(page.getByText("El reporte tiene 281 caracteres. El máximo es 280.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar reporte" })).toBeDisabled();

  for (const n of [2, 3, 4, 5]) {
    await sendReport(page, `Hecho distinto número ${n} en otro local`);
    await expect(list.getByText(`Hecho distinto número ${n} en otro local`)).toBeVisible();
  }
  await expect(page.getByText("Ya enviaste tus 5 reportes.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Qué pasó" })).toHaveCount(0);
  // El más reciente queda arriba.
  await expect(list.getByRole("listitem").first()).toContainText("número 5");

  // El nombre se recuerda en este navegador.
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Tu nombre" })).toHaveCount(0);

  // La cookie de sesión no es legible desde la página y el DOM no la contiene.
  expect(await page.evaluate(() => document.cookie)).not.toContain("relevo_session");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `.impeccable/review/canal-${test.info().project.name}.png`, fullPage: true });
});
