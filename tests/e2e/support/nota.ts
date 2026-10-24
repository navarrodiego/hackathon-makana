import type { Page } from "@playwright/test";

/** Campo de la nota en `/rodrigo`: visible y editable desde el inicio, con el resumen del turno ya escrito. */
export async function campoNota(page: Page) {
  const field = page.getByLabel("Nota para quien entra (opcional)");
  await field.waitFor();
  return field;
}
