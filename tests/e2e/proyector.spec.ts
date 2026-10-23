import { expect, test } from "@playwright/test";

/** Proyector público: solo lectura, QR a /canal, desconexión visible y limpieza al salir. Usa el servidor real. */
test.skip(!process.env.APP_ORIGIN, "Falta APP_ORIGIN");

test("proyector: estado, QR, sin controles ni secretos", async ({ page }) => {
  await page.goto("/proyector");
  await expect(page.getByRole("heading", { name: "Proyector" })).toBeVisible();
  await expect(page.getByText(/Conectado · actualizado a las/)).toBeVisible();
  await expect(page.getByRole("img", { name: /Código QR que abre .*\/canal/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Avisos a Rodrigo: \d+/ })).toBeVisible();
  await expect(page.getByText(/despertares:/i)).toHaveCount(0);
  for (const [name, width, height] of [["1920x1080", 1920, 1080], ["1280x720", 1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `docs/evidence/T15-proyector-${name}.png`, fullPage: true });
  }
  await expect(page.locator("main button")).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toMatch(/authorization|bearer|ntfy\.sh\/[a-z0-9]{8,}/i);
});

test("proyector: marca la desconexión y se recupera", async ({ page, context }) => {
  await page.goto("/proyector");
  await expect(page.getByText(/Conectado · actualizado a las/)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión desde las/)).toBeVisible();
  await expect(page.getByText(/no el estado actual/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Conectado · actualizado a las/)).toBeVisible();
});

test("proyector: consulta cada segundo y deja de consultar al salir", async ({ page }) => {
  const calls: number[] = [];
  page.on("request", r => { if (r.url().endsWith("/api/state")) calls.push(Date.now()); });
  await page.goto("/proyector");
  await expect.poll(() => calls.length, { timeout: 8000 }).toBeGreaterThanOrEqual(3);
  await page.goto("/canal");
  await page.waitForTimeout(500);
  const before = calls.length;
  await page.waitForTimeout(2500);
  expect(calls.length).toBe(before);
});
