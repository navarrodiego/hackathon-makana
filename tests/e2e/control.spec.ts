import { expect, test, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import { OPERATOR_SECRET, basicAs, loginAs } from "./support/acceso";

config({ quiet: true });

/**
 * Control protegido contra el servidor real y la base local del worktree (ejecutar con --workers=1).
 * Necesita APP_ORIGIN igual a la URL de pruebas y OPERATOR_SECRET descartable.
 */
const basic = basicAs("control");
const configured = Boolean(OPERATOR_SECRET && process.env.APP_ORIGIN);

test.describe.configure({ mode: "serial" });

test("sin sesión /control muestra el ingreso y ninguna acción", async ({ page }) => {
  await page.goto("/control");
  await expect(page.getByLabel("Contraseña de operador")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar a control" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reiniciar|Escena/ })).toHaveCount(0);
});

test.describe("con credencial de control", () => {
  test.skip(!configured, "Faltan APP_ORIGIN y las credenciales de control descartables");
  test.beforeEach(async ({ context, baseURL }) => { await loginAs(context, "control", baseURL!); });

  async function state(request: APIRequestContext, baseURL: string) {
    return (await (await request.get(`${baseURL}/api/state`)).json()).data as { executionId: string; version: number };
  }
  async function reset(request: APIRequestContext, baseURL: string) {
    const s = await state(request, baseURL);
    const r = await request.post(`${baseURL}/api/reset`, {
      headers: { authorization: basic, origin: baseURL },
      data: { idempotencyKey: `e2e-${crypto.randomUUID()}`, executionId: s.executionId, expectedVersion: s.version },
    });
    expect(r.status(), await r.text()).toBe(201);
  }

  test("paso del guion, canal, atajos, RR con confirmación y reset", async ({ page, request, baseURL }) => {
    await reset(request, baseURL!);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/control");
    await expect(page.getByRole("heading", { name: "Control", exact: true })).toBeVisible();
    // Tras el reset el guion está en el cierre; solo queda a la vista lo que el presentador usa.
    await expect(page.getByRole("status").filter({ hasText: /^Cierre de turno · / })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar la noche y abrir el canal" })).toBeEnabled();
    await expect(page.getByText("En vivo")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Resultados de aviso" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Escena anterior|Mostrar QR/ })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /Canal cerrado/ })).toBeVisible();

    // Atajo O abre el canal con origen escenario; el estado viene del servidor.
    await page.keyboard.press("o");
    await expect(page.getByRole("status").filter({ hasText: /Canal abierto/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("origen escenario").first()).toBeVisible({ timeout: 15_000 });

    // Reporte guionado entra por el servicio común.
    await page.getByRole("button", { name: "VPN lenta" }).click();
    await expect(page.getByText(/Reporte guionado «VPN lenta» enviado/)).toBeVisible();

    // Los atajos no se disparan al escribir en un campo editable.
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.setAttribute("aria-label", "prueba");
      document.body.append(input);
      input.focus();
    });
    await page.keyboard.type("oirr");
    await expect(page.getByRole("status").filter({ hasText: /Canal abierto/ })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // RR solo pide confirmación; Escape cancela y no reinicia.
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const before = await state(request, baseURL!);
    await page.keyboard.press("r");
    await page.keyboard.press("r");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect((await state(request, baseURL!)).executionId).toBe(before.executionId);

    // Confirmado, crea una ejecución nueva con el canal cerrado.
    await page.getByRole("button", { name: "Reiniciar demostración" }).click();
    await page.getByRole("button", { name: "Reiniciar ahora" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Canal cerrado/ })).toBeVisible({ timeout: 15_000 });
    expect((await state(request, baseURL!)).executionId).not.toBe(before.executionId);
    expect(errors).toEqual([]);
  });

  test("el guion avanza a la noche con el canal abierto y luego a la mañana", async ({ page, request, baseURL }) => {
    await reset(request, baseURL!);
    await page.goto("/control");
    await page.getByRole("button", { name: "Empezar la noche y abrir el canal" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Noche · 22:1\d.*Canal abierto/ })).toBeVisible({ timeout: 15_000 });
    // El atajo se ignora mientras la acción anterior termina: se espera su confirmación.
    await expect(page.getByText(/el canal está abierto\. Registrado con origen escenario/)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status").filter({ hasText: /^Mañana · 07:0\d.*Canal abierto/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Terminó el guion. Para repetirlo, reinicia la demostración.")).toBeVisible();
  });

  test("con el canal cerrado el reporte guionado no se envía y se explica", async ({ page, request, baseURL }) => {
    await reset(request, baseURL!);
    await page.goto("/control");
    await expect(page.getByRole("button", { name: "VPN lenta" })).toBeDisabled();
    await expect(page.getByText(/El canal está cerrado/).first()).toBeVisible();
  });

  test("Tomar incidente como Tomás queda deshabilitado sin incidente en espera", async ({ page, request, baseURL }) => {
    await reset(request, baseURL!);
    await page.goto("/control");
    await expect(page.getByRole("button", { name: "Tomar incidente como Tomás" })).toBeDisabled();
  });

  test("no hay controles privilegiados en el proyector público", async ({ page }) => {
    await page.goto("/proyector");
    await expect(page.getByRole("button", { name: /Reiniciar|Tomar incidente/ })).toHaveCount(0);
  });
});
