import { expect, test, type APIRequestContext } from "@playwright/test";
import { OPERATOR_SECRET, basicAs, loginAs } from "./support/acceso";
import { enterChannel } from "./support/canal";

/**
 * Sincronización entre pantallas sin recargar, contra el servidor real y la base local del worktree.
 * Necesita APP_ORIGIN igual a la URL de pruebas y OPERATOR_SECRET. Reinicia la ejecución: ejecutar con `--workers=1`.
 */
test.skip(!OPERATOR_SECRET || !process.env.APP_ORIGIN, "Faltan APP_ORIGIN y las credenciales de control descartables");
test.describe.configure({ mode: "serial" });

async function state(request: APIRequestContext, origin: string) {
  return (await (await request.get(`${origin}/api/state`)).json()).data as { executionId: string; version: number };
}
async function reset(request: APIRequestContext, origin: string) {
  const before = await state(request, origin);
  const response = await request.post(`${origin}/api/reset`, {
    headers: { authorization: basicAs("control"), origin },
    data: { idempotencyKey: `e2e-${crypto.randomUUID()}`, executionId: before.executionId, expectedVersion: before.version },
  });
  expect(response.status(), await response.text()).toBeLessThan(300);
}

test("una acción en control avisa al proyector del mismo navegador sin esperar su turno", async ({ context, request, baseURL }) => {
  const origin = baseURL!;
  await reset(request, origin);
  await loginAs(context, "control", origin);
  const projector = await context.newPage();
  const panel = await context.newPage();
  const reads: number[] = [];
  projector.on("request", r => { if (r.url().endsWith("/api/state")) reads.push(Date.now()); });
  await projector.goto("/proyector");
  await expect(projector.getByText(/^En vivo/)).toBeVisible();
  await panel.goto("/control");
  await expect(panel.getByRole("button", { name: "Abrir canal" })).toBeEnabled();

  const done = panel.waitForResponse(r => r.url().endsWith("/api/scene") && r.request().method() === "POST");
  await panel.getByRole("button", { name: "Abrir canal" }).click();
  const answered = (await done, Date.now());
  // El proyector consulta cada segundo; el aviso entre pestañas lo adelanta muy por debajo de eso.
  await expect.poll(() => reads.some(t => t >= answered && t - answered < 400), { timeout: 2000 }).toBe(true);
  await expect(panel.getByRole("button", { name: "Cerrar canal" })).toBeVisible();
});

test("otro dispositivo ve abrirse el canal sin recargar", async ({ browser, request, baseURL }) => {
  const origin = baseURL!;
  await reset(request, origin);
  const audience = await (await browser.newContext()).newPage();
  const controlContext = await browser.newContext();
  await loginAs(controlContext, "control", origin);
  const panel = await controlContext.newPage();
  await audience.goto("/canal");
  await enterChannel(audience);
  await expect(audience.getByText("El canal abre pronto")).toBeVisible();
  // Una recarga completa borraría esta marca; un refresco de la vista la conserva.
  await audience.evaluate(() => { (window as unknown as { sinRecarga: boolean }).sinRecarga = true; });
  await panel.goto("/control");
  await panel.getByRole("button", { name: "Abrir canal" }).click();
  // Canal cerrado: consulta cada 2 s y rehace la página en cuanto cambia el estado.
  await expect(audience.getByText("El canal abre pronto")).toBeHidden({ timeout: 4000 });
  await expect(audience.getByText("Esperamos a que entren los demás.")).toBeVisible();
  expect(await audience.evaluate(() => (window as unknown as { sinRecarga?: boolean }).sinRecarga)).toBe(true);

  await panel.close();
  await controlContext.close();
  await audience.context().close();
});
