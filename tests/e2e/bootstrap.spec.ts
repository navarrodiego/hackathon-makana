import { expect, test } from "@playwright/test";

test("la portada explica cómo probar la demo sin mostrar secretos", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Relevo", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Cómo probar Relevo");
  await expect(page.getByRole("heading", { name: "Cómo probarla" })).toBeVisible();
  for (const name of ["Abrir proyector", "Abrir control", "Abrir cierre de turno", "Abrir canal"]) {
    await expect(page.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  // La contraseña de operador se entrega fuera de la página.
  await expect(page.getByText(/contraseña de operador que te enviamos/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-CL");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `.impeccable/review/${testInfo.project.name}.png`, fullPage: true });
});
