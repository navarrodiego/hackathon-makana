import { expect, type BrowserContext } from "@playwright/test";
import { config } from "dotenv";

config({ quiet: true });

/**
 * Ingreso de operador en E2E (C12): una sola contraseña descartable, OPERATOR_SECRET en `.env`.
 * `loginAs` usa la ruta real `/api/acceso`; la cookie queda en el contexto y la usan sus páginas y su `request`.
 */
export const OPERATOR_SECRET = process.env.OPERATOR_SECRET ?? "";
export type OperatorRole = "outgoing" | "control";

/** Basic de respaldo para llamadas de API sin navegador: usuario rodrigo/control y la contraseña de operador. */
export const basicAs = (role: OperatorRole) =>
  `Basic ${Buffer.from(`${role === "outgoing" ? "rodrigo" : "control"}:${OPERATOR_SECRET}`).toString("base64")}`;

export async function loginAs(context: BrowserContext, role: OperatorRole, origin: string) {
  const response = await context.request.post(`${origin}/api/acceso`, {
    headers: { origin, "content-type": "application/json" }, data: { role, secret: OPERATOR_SECRET },
  });
  expect(response.status(), await response.text()).toBe(200);
}
