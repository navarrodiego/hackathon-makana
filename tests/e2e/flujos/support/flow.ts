import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { SCRIPTED_REPORTS } from "../../../../src/components/control/logic";

/**
 * Ayudas de los flujos integrados. Toda acción pasa por las rutas reales (control, Rodrigo, enlaces del aviso);
 * la base solo se lee para comprobar lo persistido. El sumidero ntfy guarda lo que recibiría el teléfono.
 */
config({ quiet: true });

const env = process.env;
export const ORIGIN = env.APP_ORIGIN ?? "";
export const SINK = env.E2E_NTFY_URL ?? "";
export const HAS_AI = Boolean(env.OPENROUTER_API_KEY);
const basic = (u?: string, s?: string) => `Basic ${Buffer.from(`${u}:${s}`).toString("base64")}`;
export const CONTROL_AUTH = basic(env.CONTROL_USERNAME, env.CONTROL_SECRET);
export const RODRIGO_AUTH = basic(env.RODRIGO_USERNAME, env.RODRIGO_SECRET);
export const CONTROL_CREDENTIALS = { username: env.CONTROL_USERNAME ?? "", password: env.CONTROL_SECRET ?? "" };
export const RODRIGO_CREDENTIALS = { username: env.RODRIGO_USERNAME ?? "", password: env.RODRIGO_SECRET ?? "" };

/** Omite el archivo completo si el entorno no permite ejercer el backend real. */
export function requireBackend() {
  const ok = Boolean(env.DATABASE_URL && env.DIRECT_URL && env.CONTROL_USERNAME && env.CONTROL_SECRET && env.RODRIGO_USERNAME && env.RODRIGO_SECRET && ORIGIN && SINK);
  test.skip(!ok, "BLOCKED: faltan DATABASE_URL/DIRECT_URL, RODRIGO_*, CONTROL_* o el sumidero ntfy");
  // Los contextos creados a mano viven con el worker: un proyector abierto seguiría leyendo el estado (y evaluando
  // vencimientos) durante la prueba siguiente.
  test.afterEach(async ({ browser }) => { await Promise.all(browser.contexts().map(c => c.close())); });
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type State = Json;

export const key = () => `flujo-${randomUUID()}`;

export async function state(request: APIRequestContext): Promise<State> {
  const response = await request.get(`${ORIGIN}/api/state`, { headers: { "cache-control": "no-store" } });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

/** Repite la lectura de estado (que también evalúa vencimientos) hasta que se cumple la condición. */
export async function waitState(request: APIRequestContext, predicate: (s: State) => boolean, message: string, timeout = 20_000): Promise<State> {
  let last: State = {};
  await expect.poll(async () => predicate(last = await state(request)), { message, timeout, intervals: [500] }).toBe(true);
  return last;
}

async function post(request: APIRequestContext, path: string, auth: string, body: Json) {
  const response = await request.post(`${ORIGIN}${path}`, {
    headers: { authorization: auth, origin: ORIGIN, "content-type": "application/json" },
    data: { idempotencyKey: key(), ...body },
  });
  return { status: response.status(), body: await response.json().catch(() => ({})) as Json };
}
export const control = (request: APIRequestContext, path: string, body: Json) => post(request, path, CONTROL_AUTH, body);
export const rodrigo = (request: APIRequestContext, path: string, body: Json) => post(request, path, RODRIGO_AUTH, body);

export async function db<T>(work: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: env.DIRECT_URL });
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}
export const rows = <T = Json>(sql: string, params: unknown[] = []) => db(async c => (await c.query(sql, params)).rows as T[]);

export async function actors(executionId: string): Promise<Record<string, string>> {
  const list = await rows<{ id: string; displayName: string }>(`select id, "displayName" from actors where "executionId"=$1`, [executionId]);
  return Object.fromEntries(list.map(a => [a.displayName, a.id]));
}
export async function sceneId(executionId: string, label: string): Promise<string> {
  const [scene] = await rows<{ id: string }>(`select id from scenes where "executionId"=$1 and label=$2`, [executionId, label]);
  return scene.id;
}

/** Reinicio protegido por la API de control; espera a que la preparación de la nota termine (ready o failed). */
export async function reset(request: APIRequestContext): Promise<State> {
  const before = await state(request);
  let response = await control(request, "/api/reset", { executionId: before.executionId, expectedVersion: before.version });
  if (response.status === 409) {
    // Otra operación subió la versión entre la lectura y el reset: el presentador recargaría y repetiría.
    const current = await state(request);
    response = await control(request, "/api/reset", { executionId: current.executionId, expectedVersion: current.version });
  }
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return waitState(request, s => s.executionId !== before.executionId && s.preparation !== "pending", "preparación de la nota", 60_000);
}

/** Cambia de escena con la misma ruta que usa el control. */
export async function scene(request: APIRequestContext, label: string, channelOpen: boolean): Promise<State> {
  const s = await state(request);
  const response = await control(request, "/api/scene", { executionId: s.executionId, expectedVersion: s.version, sceneId: await sceneId(s.executionId, label), channelOpen });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return state(request);
}

/** Envío de Rodrigo con la propuesta sembrada de cada pendiente. */
export async function sendHandoff(request: APIRequestContext): Promise<State> {
  const s = await state(request);
  const [handoff] = await rows<{ id: string; version: number; ticketIds: string[] }>(`select id, version, "ticketIds" from handoffs where "executionId"=$1`, [s.executionId]);
  const tickets = await rows<{ id: string; disposition: string; reason: string }>(`select id, disposition, reason from tickets where "executionId"=$1 and id = any($2)`, [s.executionId, handoff.ticketIds]);
  const sent = await rodrigo(request, "/api/handoff", {
    executionId: s.executionId, handoffId: handoff.id, expectedVersion: handoff.version,
    note: "Revisa #470: el respaldo falló y el próximo intento es a las 02:00. El resto puede esperar.",
    tickets: tickets.map(t => ({ ticketId: t.id, disposition: t.disposition, reason: t.reason })),
  });
  expect(sent.status, JSON.stringify(sent.body)).toBe(201);
  return state(request);
}

export interface SinkMessage { id: string; receivedAt: string; body: Json }
export async function sinkMessages(request: APIRequestContext): Promise<SinkMessage[]> {
  return (await request.get(`${SINK}/messages`)).json();
}
/** Espera el aviso ntfy que cumple la condición; la lectura de estado mantiene el despachador en marcha. */
export async function waitNtfy(request: APIRequestContext, match: (m: SinkMessage) => boolean, message: string, timeout = 20_000): Promise<SinkMessage> {
  let found: SinkMessage | undefined;
  await expect.poll(async () => {
    await state(request);
    found = (await sinkMessages(request)).find(match);
    return Boolean(found);
  }, { message, timeout, intervals: [500] }).toBe(true);
  return found!;
}
export const handoffNotice = (handoffId: string) => (m: SinkMessage) => typeof m.body.click === "string" && m.body.click.includes(`/relevo/${encodeURIComponent(handoffId)}?`);
export const incidentNotice = (incidentId: string) => (m: SinkMessage) => Array.isArray(m.body.actions) && m.body.actions.some((a: Json) => a.url.endsWith(`/api/ack/${encodeURIComponent(incidentId)}`));

/** Token del enlace o de la acción; solo para comprobar que no aparece en superficies públicas. */
export function tokenOf(m: SinkMessage): string {
  if (m.body.click) return new URL(m.body.click).searchParams.get("token")!;
  return String(m.body.actions[0].headers.Authorization).replace(/^Bearer /, "");
}
/** Ejecuta la acción HTTP del aviso exactamente como la app ntfy del teléfono: sin Origin ni cookies. */
export async function pressNtfyAction(request: APIRequestContext, m: SinkMessage): Promise<APIResponse> {
  const action = m.body.actions[0];
  return request.fetch(action.url, { method: action.method, headers: action.headers, data: action.body });
}

/**
 * Acepta por la misma ruta que la página de revisión, con el token del aviso. `attemptId` permite reproducir una
 * respuesta tardía con el intento que esa persona recibió, no el vigente.
 */
export async function acceptAs(request: APIRequestContext, notice: SinkMessage, attemptId?: string): Promise<APIResponse> {
  const s = await state(request);
  return request.post(`${ORIGIN}/api/handoff/${encodeURIComponent(s.handoff.id)}/accept`, {
    headers: { authorization: `Bearer ${tokenOf(notice)}`, origin: ORIGIN, "content-type": "application/json" },
    data: { executionId: s.executionId, attemptId: attemptId ?? s.handoff.attemptId, expectedVersion: s.handoff.version, idempotencyKey: key() },
  });
}

/** Palabras como las cuenta el límite de 60 de la nota. */
export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const SECRET_HINTS = ["e2e-local", "Bearer "];
/** Ningún token de aviso ni el tópico aparece en el texto o el HTML de una superficie pública. */
export function expectNoSecrets(content: string, notices: SinkMessage[]) {
  for (const n of notices) expect(content, "token de aviso expuesto").not.toContain(tokenOf(n));
  for (const hint of SECRET_HINTS) expect(content, `${hint} expuesto`).not.toContain(hint);
}

/** Reporte guionado como lo envía el control (origen escenario, mismo servicio que el canal). */
export async function scriptedReport(request: APIRequestContext, text: string): Promise<Json> {
  const s = await state(request);
  const response = await control(request, "/api/messages", { executionId: s.executionId, nickname: "Guion", text });
  expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
  return response.body.data;
}

/** Cobertura activa de Paula: envío, aceptación desde su aviso y escena de la ventana con canal abierto. */
export async function activeCoverage(request: APIRequestContext): Promise<{ s: State; who: Record<string, string>; handoffNotice: SinkMessage }> {
  await reset(request);
  const sent = await sendHandoff(request);
  const notice = await waitNtfy(request, handoffNotice(sent.handoff.id), "aviso de relevo para Paula");
  expect((await acceptAs(request, notice)).status()).toBe(200);
  await scene(request, "Canal", true);
  const s = await waitState(request, x => x.coverage?.status === "active", "cobertura activa");
  return { s, who: await actors(s.executionId), handoffNotice: notice };
}

/** Textos de los chips guionados del control: las pruebas usan los mismos que el pitch. */
const chip = (id: string) => SCRIPTED_REPORTS.find(r => r.id === id)!;
export const BILLING = chip("billing").text;
export const PRINTER = chip("printer").text;
export const PRINTER_LABEL = chip("printer").label;
export const WAKE = chip("wake").text;

export const eventsOf = (executionId: string, kind: string) =>
  rows<{ kind: string; origin: string; actorId: string | null }>(`select kind, origin, "actorId" from events where "executionId"=$1 and kind=$2 order by sequence`, [executionId, kind]);
