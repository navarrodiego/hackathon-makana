import type { Page } from "@playwright/test";

/**
 * Campo de la nota en `/rodrigo`. Vive plegado bajo «Editar nota» (se abre solo si la nota no se generó);
 * lo abre solo si está cerrado, para no plegarlo de nuevo.
 */
export async function campoNota(page: Page) {
  const toggle = page.getByText("Editar nota", { exact: true });
  await toggle.waitFor();
  const field = page.getByLabel("Nota del relevo");
  if (!(await field.isVisible())) await toggle.click();
  return field;
}
