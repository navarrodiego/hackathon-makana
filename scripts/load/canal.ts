import "dotenv/config";
import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { Client } from "pg";

/**
 * Prueba de carga del canal público: N teléfonos simulados con sesión propia. Cada uno consulta /api/state cada
 * 4 s (±20 %), rehace /canal cada 15 s como la relectura de seguridad y envía reportes después de la espera común
 * de 30 s. Un proyector simulado consulta cada 1 s y se mide aparte. Antes reinicia la ejecución y abre el canal.
 *
 * Por defecto solo contra un servidor local (`pnpm build && pnpm start`) y la base de este worktree.
 * Un preview de Vercel exige `--remote` y su propio `.env.load` (ignorado por git) con:
 *   LOAD_DIRECT_URL      conexión directa a la rama de Neon del preview, nunca la de la demo
 *   LOAD_OPERATOR_SECRET contraseña de operador descartable del preview
 *   LOAD_BYPASS_SECRET   «Protection Bypass for Automation» del proyecto (las vistas previas piden ingreso)
 * Producción exige además `--production` y acepta `OPERATOR_SECRET`/`DIRECT_URL` del archivo: ensucia la ejecución de
 * la demo, gasta clasificaciones y puede avisar al teléfono real; usar `--reset-after`.
 *
 *   --burst        el primer reporte de cada teléfono sale en los 2 s siguientes a la espera (peor caso del guion)
 *   --reset-after  reinicia la ejecución al terminar (canal cerrado)
 *   --env-file     archivo de credenciales remotas (por defecto .env.load)
 *
 *   pnpm load:canal -- --clients 40 --seconds 60 --url http://127.0.0.1:3000
 *   pnpm load:canal -- --remote --clients 40 --seconds 90 --reports 2 --url https://<preview>.vercel.app
 *   pnpm load:canal -- --remote --production --clients 50 --seconds 120 --burst --reset-after --url https://relevo-dun.vercel.app
 */
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith("--")));
const args = new Map(process.argv.slice(2).flatMap((a, i, all) => a.startsWith("--") ? [[a.slice(2), all[i + 1]]] : []));
const base = new URL(args.get("url") ?? "http://127.0.0.1:3000");
const clients = Number(args.get("clients") ?? 40);
const seconds = Number(args.get("seconds") ?? 60);
const reportsPerClient = Number(args.get("reports") ?? 3);
const burst = flags.has("--burst");
const resetAfter = flags.has("--reset-after");
const PRODUCTION_HOSTS = ["relevo-dun.vercel.app"];
const LOBBY_MS = 30_000;
const remote = flags.has("--remote");
const production = flags.has("--production");
const local = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
if (!local && !remote) throw new Error("Destino no local: usa --remote con un preview y su .env.load.");
if (PRODUCTION_HOSTS.includes(base.hostname) !== production) {
  throw new Error(production ? "--production solo vale para el dominio de producción." : "Producción exige --remote --production: ensucia la ejecución de la demo.");
}
if (seconds * 1000 <= LOBBY_MS + 10_000) throw new Error("--seconds debe superar la espera común de 30 s en al menos 10 s.");
const remoteEnv = remote ? parse(readFileSync(args.get("env-file") ?? ".env.load")) : {};
const secret = remote ? remoteEnv.LOAD_OPERATOR_SECRET ?? (production ? remoteEnv.OPERATOR_SECRET : undefined) : process.env.OPERATOR_SECRET;
const directUrl = remote ? remoteEnv.LOAD_DIRECT_URL ?? (production ? remoteEnv.DIRECT_URL : undefined) : process.env.DIRECT_URL;
if (!secret || !directUrl) throw new Error(remote ? "Faltan la contraseña de operador y la conexión directa en el archivo remoto." : "Falta OPERATOR_SECRET en .env.");
if (remote && (directUrl === process.env.DIRECT_URL || /@(127\.0\.0\.1|localhost)[:/]/.test(directUrl))) throw new Error("La conexión remota no puede ser la base local.");
const origin = base.origin;
/** Encabezado de Vercel para saltar el ingreso de las vistas previas; nunca se imprime. */
const bypass: Record<string, string> = remote && remoteEnv.LOAD_BYPASS_SECRET
  ? { "x-vercel-protection-bypass": remoteEnv.LOAD_BYPASS_SECRET } : {};
const basic = `Basic ${Buffer.from(`control:${secret}`).toString("base64")}`;
/** Atajos guionados del canal, para no medir solo duplicados de un mismo hecho. */
const TEXTS = [
  "la caja {n} no emite boletas", "se cayó el internet en el local {n}", "la impresora del piso {n} no imprime",
  "la VPN está muy lenta desde la sucursal {n}", "no pasa la tarjeta en la caja {n}",
];

interface Sample { readonly kind: "state" | "proj" | "page" | "send"; readonly ms: number; readonly status: number; readonly code: string | null }
const samples: Sample[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

async function timed(kind: Sample["kind"], run: () => Promise<Response>): Promise<Response | null> {
  const started = performance.now();
  try {
    const response = await run();
    const body = kind === "page" ? (await response.text(), null) : await response.json().catch(() => null) as { error?: { code?: string } } | null;
    samples.push({ kind, ms: performance.now() - started, status: response.status, code: body?.error?.code ?? null });
    return response;
  } catch {
    samples.push({ kind, ms: performance.now() - started, status: 0, code: "NETWORK" });
    return null;
  }
}

async function state() {
  return (await (await fetch(`${origin}/api/state`, { headers: bypass })).json()).data as { executionId: string; version: number; channelOpen: boolean; incidents: readonly unknown[] };
}
async function command(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST", headers: { ...bypass, authorization: basic, origin, "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `load-${crypto.randomUUID()}`, ...body }),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
}
async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = new Client({ connectionString: directUrl });
  await db.connect();
  try { return (await db.query(sql, params)).rows as T[]; } finally { await db.end(); }
}
async function channelScene(): Promise<string> {
  const rows = await query<{ id: string }>(`SELECT id FROM scenes WHERE label='Canal' AND "executionId"=(SELECT "executionId" FROM executions WHERE status='active')`);
  return rows[0].id;
}

async function phone(index: number, executionId: string, sendsFrom: number, until: number) {
  await sleep(Math.random() * 3000);
  const entry = await fetch(`${origin}/canal`, { headers: bypass });
  const cookie = (entry.headers.get("set-cookie") ?? "").split(";")[0];
  await entry.text();
  const window = (until - sendsFrom) * 0.85;
  const sendAt = Array.from({ length: reportsPerClient }, (_, i) =>
    sendsFrom + (burst && i === 0 ? Math.random() * 2000 : 2000 + Math.random() * (window - 2000))).sort((a, b) => a - b);
  const sender = (async () => {
    for (const [i, at] of sendAt.entries()) {
      await sleep(at - Date.now());
      const text = TEXTS[(index + i) % TEXTS.length].replace("{n}", String((index % 9) + 1));
      await timed("send", () => fetch(`${origin}/api/messages`, {
        method: "POST", headers: { ...bypass, cookie, origin, "content-type": "application/json", "x-relevo-canal": "1" },
        body: JSON.stringify({ executionId, idempotencyKey: `load-${crypto.randomUUID()}`, nickname: `Carga ${index}`, text: `Prueba de carga: ${text}` }),
      }));
    }
  })();
  let nextPage = Date.now() + 15_000;
  while (Date.now() < until) {
    await timed("state", () => fetch(`${origin}/api/state`, { headers: { ...bypass, cookie } }));
    if (Date.now() >= nextPage) {
      nextPage = Date.now() + 15_000;
      await timed("page", () => fetch(`${origin}/canal`, { headers: { ...bypass, cookie } }));
    }
    await sleep(4000 * (0.8 + 0.4 * Math.random()));
  }
  await sender;
}

async function projector(until: number) {
  while (Date.now() < until) {
    const started = Date.now();
    await timed("proj", () => fetch(`${origin}/api/state`, { headers: bypass }));
    await sleep(1000 - (Date.now() - started));
  }
}

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

if (production) {
  console.warn(`PRODUCCIÓN ${origin}: reinicia la ejecución de la demo y envía hasta ${clients * reportsPerClient} reportes reales. Ctrl-C en 5 s para cancelar.`);
  await sleep(5000);
}
const before = await state();
await command("/api/reset", { executionId: before.executionId, expectedVersion: before.version });
const fresh = await state();
await command("/api/scene", { executionId: fresh.executionId, expectedVersion: fresh.version, sceneId: await channelScene(), channelOpen: true });
const sendsFrom = Date.now() + LOBBY_MS + 500;
const opened = await state();
console.info(`Canal abierto en ${opened.executionId}. ${clients} teléfonos durante ${seconds} s contra ${origin}${burst ? ", con ráfaga al terminar la espera" : ""}.`);
const until = Date.now() + seconds * 1000;
await Promise.all([projector(until), ...Array.from({ length: clients }, (_, i) => phone(i, opened.executionId, sendsFrom, until))]);

// Deja que el último sondeo rescate lo que quedó en cola y cuenta reportes trabados.
await sleep(2000);
await fetch(`${origin}/api/state`, { headers: bypass });
const byStatus = await query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM reports WHERE "executionId"=$1 GROUP BY status`, [opened.executionId]);
const byMode = await query<{ mode: string; n: number }>(`SELECT coalesce(value->>'mode','sin clasificación') AS mode, count(*)::int AS n FROM report_classifications WHERE "executionId"=$1 GROUP BY 1`, [opened.executionId]);
const incidents = (await state()).incidents.length;

for (const kind of ["proj", "state", "page", "send"] as const) {
  const list = samples.filter(s => s.kind === kind);
  const ms = list.map(s => s.ms);
  const codes = Object.entries(list.reduce<Record<string, number>>((acc, s) => {
    const key = s.status >= 200 && s.status < 300 ? String(s.status) : `${s.status} ${s.code ?? ""}`.trim();
    acc[key] = (acc[key] ?? 0) + 1; return acc;
  }, {})).map(([k, v]) => `${k}×${v}`).join(", ");
  console.info(`${kind.padEnd(5)} n=${list.length} p50=${percentile(ms, 0.5).toFixed(0)} ms p95=${percentile(ms, 0.95).toFixed(0)} ms max=${percentile(ms, 1).toFixed(0)} ms  ${codes}`);
}
const count = (code: string) => samples.filter(s => s.code === code).length;
const fmt = (rows: { n: number }[], key: "status" | "mode") => rows.map(r => `${(r as Record<string, unknown>)[key]}×${r.n}`).join(", ") || "ninguno";
console.info(`Reportes por estado: ${fmt(byStatus, "status")}. Clasificación: ${fmt(byMode, "mode")}. Incidentes: ${incidents}.`);
console.info(`STORAGE_UNAVAILABLE: ${count("STORAGE_UNAVAILABLE")}. CHANNEL_WAITING: ${count("CHANNEL_WAITING")}. Red: ${count("NETWORK")}.`);

if (resetAfter) {
  const last = await state();
  await command("/api/reset", { executionId: last.executionId, expectedVersion: last.version });
  const clean = await state();
  console.info(`Reinicio final: ${clean.executionId}, canal ${clean.channelOpen ? "abierto" : "cerrado"}, incidentes ${clean.incidents.length}.`);
}
