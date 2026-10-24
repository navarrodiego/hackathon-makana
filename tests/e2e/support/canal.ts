import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

/** Primer paso de /canal: el nombre (no identifica ni da permisos). */
export async function enterChannel(page: Page, name = "Visita") {
  await page.getByRole("textbox", { name: "Tu nombre" }).fill(name);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(`Hola, ${name}.`)).toBeVisible();
}

/**
 * Da por cumplida la espera común tras abrir el canal, moviendo su ancla 30 s atrás en la base local de pruebas.
 * Solo para pruebas que no verifican la espera; `canal.spec.ts` la recorre en tiempo real.
 */
export async function skipLobby(connectionString = process.env.DIRECT_URL) {
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query(`UPDATE executions SET "channelOpenedAt" = "channelOpenedAt" - interval '30 seconds' WHERE status='active' AND "channelOpenedAt" IS NOT NULL`);
  } finally { await db.end(); }
}

export async function sendReport(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Qué pasó" }).fill(text);
  await page.getByRole("button", { name: "Enviar reporte" }).click();
}
