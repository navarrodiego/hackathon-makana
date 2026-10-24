import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { basicAs } from "./support/acceso";

// Requiere servidor de producción local con la base propia del worktree, APP_ORIGIN igual al origen de pruebas y
// contraseña ficticia OPERATOR_SECRET. Ejecutar con --workers=1: cada prueba crea su propia ejecución.
config({ quiet: true });
const PORT = Number(process.env.E2E_PORT || 34137);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CONTROL = basicAs("control");
const RODRIGO = basicAs("outgoing");
const configured = Boolean(process.env.DATABASE_URL && process.env.OPERATOR_SECRET && process.env.APP_ORIGIN === ORIGIN);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "BLOCKED: faltan DATABASE_URL, OPERATOR_SECRET o APP_ORIGIN para el servidor de pruebas.");

const json = { "content-type": "application/json", origin: ORIGIN };
const key = () => `e2e.${randomBytes(8).toString("hex")}`;

async function db<T>(work: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }); // el rol de la app ya ocupa su límite
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}

interface Scene { executionId: string; handoffId: string; attemptId: string; token: string; actors: Record<string, string> }

/** Ejecución nueva por prueba, envío real por la API de Rodrigo y concesión equivalente a la que emite el transporte. */
async function freshHandoff(request: APIRequestContext): Promise<Scene> {
  const state = await (await request.get(`${ORIGIN}/api/state`)).json();
  const reset = await request.post(`${ORIGIN}/api/reset`, { headers: { ...json, authorization: CONTROL }, data: { executionId: state.data.executionId, expectedVersion: state.data.version, idempotencyKey: key() } });
  expect(reset.status()).toBe(201);
  const executionId: string = (await reset.json()).data.executionId;
  const seed = await db(async c => {
    const h = (await c.query(`select id, version, "ticketIds" from handoffs where "executionId"=$1`, [executionId])).rows[0];
    const t = (await c.query(`select id, disposition, reason from tickets where "executionId"=$1 and id = any($2)`, [executionId, h.ticketIds])).rows;
    const a = (await c.query(`select id, "displayName" from actors where "executionId"=$1`, [executionId])).rows;
    return { h, t, a };
  });
  const actors = Object.fromEntries(seed.a.map((r: { id: string; displayName: string }) => [r.displayName, r.id]));
  const send = await request.post(`${ORIGIN}/api/handoff`, { headers: { ...json, authorization: RODRIGO }, data: {
    executionId, handoffId: seed.h.id, expectedVersion: seed.h.version, idempotencyKey: key(), note: "Revisa #470: el respaldo falló y el próximo intento es a las 02:00. Sin urgencia inmediata.",
    tickets: seed.t.map((x: { id: string; disposition: string; reason: string }) => ({ ticketId: x.id, disposition: x.disposition, reason: x.reason })),
  } });
  expect(send.status()).toBe(201);
  const attemptId: string = (await send.json()).data.handoff.attemptId;
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db(c => c.query(`insert into recipient_grants ("credentialHash","executionId","actorId",scope,"issuedAt","expiresAt") values ($1,$2,$3,$4,$5,$6)`, [
    createHash("sha256").update(token).digest("hex"), executionId, actors["Paula"],
    JSON.stringify({ entity: "handoff", entityId: seed.h.id, attemptId, actions: ["read_handoff", "accept_handoff", "reject_handoff"] }), now, new Date(now.getTime() + 25 * 60_000)]));
  return { executionId, handoffId: seed.h.id, attemptId, token, actors };
}

const link = (s: Scene, token = s.token) => `/relevo/${encodeURIComponent(s.handoffId)}?token=${encodeURIComponent(token)}`;
const attempts = (executionId: string) => db(async c => (await c.query(`select status, "candidateActorId" from handoff_attempts where "executionId"=$1 order by position`, [executionId])).rows as { status: string; candidateActorId: string }[]);

test("abrir el enlace muestra el paquete y no acepta (S02)", async ({ page, request }) => {
  const s = await freshHandoff(request);
  const response = await page.goto(link(s));
  expect(response?.headers()["cache-control"]).toMatch(/no-store/);
  await expect(page.getByRole("heading", { name: "Revisión del relevo" })).toBeVisible();
  await expect(page.getByText("Abrir este enlace no lo acepta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceptar relevo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "No puedo cubrir" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Pendientes del relevo" }).getByRole("listitem")).toHaveCount(3);
  expect((await attempts(s.executionId)).map(a => a.status)).toEqual(["pending"]);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  await expect(page.locator('a[href^="http"]')).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(s.token);
});

test("aceptación anticipada: explica inicio futuro, no activa, y un doble toque no duplica (R02/R06)", async ({ page, request }) => {
  const s = await freshHandoff(request);
  await page.goto(link(s));
  const accept = page.getByRole("button", { name: "Aceptar relevo" });
  await accept.dblclick();
  await expect(page.getByText(/Aceptaste el relevo\. Tu cobertura comienza a las 22:10/)).toBeVisible();
  await expect(page.getByText(/cobertura activa/i)).toHaveCount(0);
  expect((await attempts(s.executionId)).map(a => a.status)).toEqual(["accepted"]);
  await page.reload();
  await expect(page.getByText(/Aceptaste el relevo\. Tu cobertura comienza a las 22:10/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceptar relevo" })).toHaveCount(0);
});

test("No puedo cubrir deriva; una acción tardía no reasigna y el enlace dice que ya fue derivado (R06/S01)", async ({ page, request }) => {
  const s = await freshHandoff(request);
  await page.goto(link(s));
  await page.getByRole("button", { name: "No puedo cubrir" }).click();
  await expect(page.getByText("Indicaste que no puedes cubrir")).toBeVisible();
  const after = await attempts(s.executionId);
  expect(after.map(a => a.status)).toEqual(["rejected", "pending"]);
  expect(after[1].candidateActorId).toBe(s.actors["Tomás"]);

  const late = await request.post(`${ORIGIN}/api/handoff/${s.handoffId}/accept`, { headers: { ...json, authorization: `Bearer ${s.token}` }, data: { executionId: s.executionId, attemptId: s.attemptId, expectedVersion: 1, idempotencyKey: key() } });
  expect([409, 410]).toContain(late.status());
  expect((await attempts(s.executionId)).map(a => a.status)).toEqual(["rejected", "pending"]);

  await page.goto(link(s));
  await expect(page.getByText("Este relevo ya fue derivado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceptar relevo" })).toHaveCount(0);
  await expect(page.getByText("Revisa #470")).toHaveCount(0);
});

test("token ausente, inválido o de otra ejecución no abre ni actúa (S01)", async ({ page, request }) => {
  const s = await freshHandoff(request);
  for (const url of [`/relevo/${s.handoffId}`, link(s, randomBytes(32).toString("base64url")), link(s, "corto")]) {
    await page.goto(url);
    await expect(page.getByText("Este enlace no permite abrir el relevo")).toBeVisible();
    await expect(page.getByText("Revisa #470")).toHaveCount(0);
  }
  const forged = await request.post(`${ORIGIN}/api/handoff/${s.handoffId}/accept`, { headers: { ...json, authorization: `Bearer ${randomBytes(32).toString("base64url")}` }, data: { executionId: s.executionId, attemptId: s.attemptId, expectedVersion: 1, idempotencyKey: key() } });
  expect(forged.status()).toBe(401);
  const wrongAttempt = await request.post(`${ORIGIN}/api/handoff/${s.handoffId}/accept`, { headers: { ...json, authorization: `Bearer ${s.token}` }, data: { executionId: s.executionId, attemptId: "handoff_attempt_otro", expectedVersion: 1, idempotencyKey: key() } });
  expect(wrongAttempt.status()).toBe(401);
  expect((await attempts(s.executionId)).map(a => a.status)).toEqual(["pending"]);

  const old = await freshHandoff(request); // una ejecución nueva retira la anterior
  await page.goto(link(s));
  await expect(page.getByText("Este enlace no permite abrir el relevo")).toBeVisible();
  expect(old.executionId).not.toBe(s.executionId);
});

test("móvil y escritorio: sin desborde horizontal y acciones de tamaño táctil", async ({ page, request }) => {
  const s = await freshHandoff(request);
  await page.goto(link(s));
  await expect(page.getByRole("button", { name: "Aceptar relevo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const name of ["Aceptar relevo", "No puedo cubrir"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  }
  await page.keyboard.press("Tab"); // salto al contenido
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
