import { expect, test, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";

config({ quiet: true });

/**
 * Regresión de accesibilidad (T19) contra el servidor real. Comprueba elementos y estados, nunca networkidle.
 * Emulación en Chrome: no certifica WCAG ni sustituye una prueba con lector de pantalla o en el S26.
 * Ejecutar con --workers=1: /control reinicia la ejecución compartida.
 */
const user = process.env.CONTROL_USERNAME ?? "";
const secret = process.env.CONTROL_SECRET ?? "";
const basic = `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;

test.skip(!user || !secret || !process.env.APP_ORIGIN, "Faltan APP_ORIGIN y las credenciales de control descartables");
test.use({ httpCredentials: { username: user, password: secret } });

async function resetExecution(request: APIRequestContext, baseURL: string) {
  const s = (await (await request.get(`${baseURL}/api/state`)).json()).data as { executionId: string; version: number };
  const r = await request.post(`${baseURL}/api/reset`, {
    headers: { authorization: basic, origin: baseURL },
    data: { idempotencyKey: `e2e-${crypto.randomUUID()}`, executionId: s.executionId, expectedVersion: s.version },
  });
  expect(r.status(), await r.text()).toBe(201);
}

/** Espera a que React haya enlazado los controles: antes de eso un atajo o un clic no hace nada. */
const hydrated = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector("button") ?? {}).some(k => k.startsWith("__reactProps")));

/**
 * Pulsa un atajo de /control hasta que el aviso confirma la acción. El sondeo de 2 s puede adelantar la versión y el
 * servidor responde «El estado cambió» (conflicto ajeno a T19, anotado en la evidencia): ese caso se reintenta.
 */
async function pressUntilNotice(page: import("@playwright/test").Page, key: string, notice: RegExp) {
  const aviso = page.locator("[data-testid='control-avisos']");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press(key);
    const settled = await expect(aviso.or(page.getByRole("alert").filter({ hasText: "No se completó" })).first())
      .toHaveText(/\S/, { timeout: 5_000 }).then(() => true, () => false);
    if (settled && notice.test(await aviso.innerText())) return;
  }
  throw new Error(`«${key}» no se completó en 6 intentos por conflictos de versión`);
}

const noHorizontalScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("las superficies no desbordan en horizontal a 320 px", async ({ page, baseURL, request }) => {
  await resetExecution(request, baseURL!);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/canal", "/proyector", "/control"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await noHorizontalScroll(page), path).toBe(true);
  }
});

test("el registro no recorta la hora con el texto ampliado", async ({ page, baseURL, request }) => {
  await resetExecution(request, baseURL!);
  await page.goto("/control");
  await hydrated(page);
  await pressUntilNotice(page, "o", /Canal abierto\./);
  await expect(page.getByText("origen escenario").first()).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  const clipped = await page.locator("ol[aria-label='Registro'] time").evaluateAll(els =>
    els.filter(el => el.scrollWidth > el.clientWidth).length);
  expect(clipped).toBe(0);
});

test.describe("/control", () => {
  test("los avisos viven en una región en vivo que ya existe antes del aviso", async ({ page, baseURL, request }) => {
    await resetExecution(request, baseURL!);
    await page.goto("/control");
    await hydrated(page);
    await expect(page.locator("[data-testid='control-avisos'][aria-live='polite']")).toHaveCount(1);
    await pressUntilNotice(page, "o", /Canal abierto\./);
  });

  test("tras una acción con teclado el foco vuelve al botón que la lanzó", async ({ page, baseURL, request }) => {
    await resetExecution(request, baseURL!);
    await page.goto("/control");
    await hydrated(page);
    const toggle = page.getByRole("button", { name: /^(Abrir|Cerrar) canal$/ });
    await toggle.focus();
    await pressUntilNotice(page, "Enter", /Canal (abierto|cerrado)\./);
    await expect(toggle).toBeFocused();
  });

  test("el diálogo de reinicio atrapa el foco y Escape lo devuelve", async ({ page, baseURL, request }) => {
    await resetExecution(request, baseURL!);
    await page.goto("/control");
    const opener = page.getByRole("button", { name: "Reiniciar demostración" });
    await opener.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("los atajos no se disparan al escribir en un campo", async ({ page, baseURL, request }) => {
    await resetExecution(request, baseURL!);
    await page.goto("/control");
    await page.evaluate(() => { const i = document.createElement("input"); i.id = "probe"; document.body.append(i); });
    await page.locator("#probe").focus();
    await page.keyboard.type("oq");
    await expect(page.getByRole("status").filter({ hasText: /^Canal cerrado ·/ })).toBeVisible();
  });
});

test.describe("/canal", () => {
  test("el resultado del envío se anuncia en una región en vivo persistente", async ({ page, baseURL, request }) => {
    await resetExecution(request, baseURL!);
    await page.goto("/control");
    await hydrated(page);
    await pressUntilNotice(page, "o", /Canal abierto\./);
    await page.goto("/canal");
    await expect(page.locator("[data-testid='canal-resultado'][aria-live='polite']")).toHaveCount(1);
    await page.getByLabel("Apodo").fill("Cuervo");
    await page.getByLabel("Reporte", { exact: true }).fill("La VPN va lenta desde el segundo piso");
    await page.getByRole("button", { name: "Enviar reporte" }).click();
    await expect(page.locator("[data-testid='canal-resultado']")).toContainText(/Reporte registrado/, { timeout: 15_000 });
  });
});

test("el contador no anuncia cada segundo", async ({ page, baseURL, request }) => {
  await resetExecution(request, baseURL!);
  await page.goto("/proyector");
  await expect(page.locator("[aria-live] [aria-hidden='true']:text-matches('^\\\\d\\\\d:\\\\d\\\\d')")).toHaveCount(0);
});
