import { expect, test } from "@playwright/test";

test("la base técnica se renderiza sin afirmar cobertura", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Relevo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Base técnica inicializada" })).toBeVisible();
  await expect(page.getByText(/no registra reportes ni confirma cobertura/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-CL");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `.impeccable/review/${testInfo.project.name}.png`, fullPage: true });
});
