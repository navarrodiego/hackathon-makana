import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

/**
 * Prueba de carga del canal público: N teléfonos simulados con sesión propia. Cada uno consulta /api/state cada
 * 4 s (±20 %), rehace /canal cada 15 s como la relectura de seguridad y envía 3 reportes en momentos al azar.
 * Antes reinicia la ejecución y abre el canal con control.
 *
 * Por defecto solo contra un servidor local (`pnpm build && pnpm start`) y la base de este worktree.
 * Un preview de Vercel exige `--remote` y su propio `.env.load` (ignorado por git) con:
 *   LOAD_DIRECT_URL      conexión directa a la rama de Neon del preview, nunca la de la demo
 *   LOAD_OPERATOR_SECRET contraseña de operador descartable del preview
 *   LOAD_BYPASS_SECRET   «Protection Bypass for Automation» del proyecto (las vistas previas piden ingreso)
 * Nunca acepta el dominio de producción.
 *
 *   pnpm load:canal -- --clients 40 --seconds 60 --url http://127.0.0.1:3000
 *   pnpm load:canal -- --remote --clients 40 --seconds 90 --reports 2 --url https://<preview>.vercel.app
 */
const args = new Map(process.argv.slice(2).flatMap((a, i, all) => a.startsWith("--") ? [[a.slice(2), all[i + 1]]] : []));
const base = new URL(args.get("url") ?? "http://127.0.0.1:3000");
const clients = Number(args.get("clients") ?? 40);
const seconds = Number(args.get("seconds") ?? 60);
const reportsPerClient = Number(args.get("reports") ?? 3);
const PRODUCTION_HOSTS = ["relevo-dun.vercel.app"];
const remote = process.argv.includes("--remote");
const local = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
if (!local && !remote) throw new Error("Destino no local: usa --remote con un preview y su .env.load.");
if (PRODUCTION_HOSTS.includes(base.hostname)) throw new Error("Nunca contra producción: ensucia la ejecución de la demo.");
if (remote) loadEnv({ path: ".env.load", override: true, quiet: true });
const secret = remote ? process.env.LOAD_OPERATOR_SECRET : process.env.OPERATOR_SECRET;
const directUrl = remote ? process.env.LOAD_DIRECT_URL : process.env.DIRECT_URL;
if (!secret || !directUrl) throw new Error(remote ? "Faltan LOAD_OPERATOR_SECRET y LOAD_DIRECT_URL en .env.load." : "Falta OPERATOR_SECRET en .env.");
if (remote && directUrl === process.env.DIRECT_URL) throw new Error("LOAD_DIRECT_URL no puede ser la base local.");
const origin = base.origin;
/** Encabezado de Vercel para saltar el ingreso de las vistas previas; nunca se imprime. */
const bypass: Record<string, string> = remote && process.env.LOAD_BYPASS_SECRET
  ? { "x-vercel-protection-bypass": process.env.LOAD_BYPASS_SECRET } : {};
const basic = `Basic ${Buffer.from(`control:${secret}`).toString("base64")}`;

interface Sample { readonly kind: "state" | "page" | "send"; readonly ms: number; readonly status: number; readonly code: string | null }
const samples: Sample[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  return (await (await fetch(`${origin}/api/state`, { headers: bypass })).json()).data as { executionId: string; version: number; channelOpen: boolean };
}
async function command(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST", headers: { ...bypass, authorization: basic, origin, "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `load-${crypto.randomUUID()}`, ...body }),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
}
async function channelScene(): Promise<string> {
  const db = new Client({ connectionString: directUrl });
  await db.connect();
  try {
    const rows = await db.query(`SELECT id FROM scenes WHERE label='Canal' AND "executionId"=(SELECT "executionId" FROM executions WHERE status='active')`);
    return rows.rows[0].id as string;
  } finally { await db.end(); }
}

async function phone(index: number, executionId: string, until: number) {
  await sleep(Math.random() * 3000);
  const entry = await fetch(`${origin}/canal`, { headers: bypass });
  const cookie = (entry.headers.get("set-cookie") ?? "").split(";")[0];
  await entry.text();
  const sendAt = Array.from({ length: reportsPerClient }, () => Date.now() + Math.random() * (until - Date.now()) * 0.8).sort();
  let nextPage = Date.now() + 15_000;
  while (Date.now() < until) {
    await timed("state", () => fetch(`${origin}/api/state`, { headers: { ...bypass, cookie } }));
    if (Date.now() >= nextPage) {
      nextPage = Date.now() + 15_000;
      await timed("page", () => fetch(`${origin}/canal`, { headers: { ...bypass, cookie } }));
    }
    while (sendAt.length && Date.now() >= sendAt[0]) {
      sendAt.shift();
      await timed("send", () => fetch(`${origin}/api/messages`, {
        method: "POST", headers: { ...bypass, cookie, origin, "content-type": "application/json", "x-relevo-canal": "1" },
        body: JSON.stringify({ executionId, idempotencyKey: `load-${crypto.randomUUID()}`, nickname: `Carga ${index}`, text: `Prueba de carga ${index}: la caja ${sendAt.length + 1} no emite boletas` }),
      }));
    }
    await sleep(4000 * (0.8 + 0.4 * Math.random()));
  }
}

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

const before = await state();
await command("/api/reset", { executionId: before.executionId, expectedVersion: before.version });
const fresh = await state();
await command("/api/scene", { executionId: fresh.executionId, expectedVersion: fresh.version, sceneId: await channelScene(), channelOpen: true });
const opened = await state();
console.info(`Canal abierto en ${opened.executionId}. ${clients} teléfonos durante ${seconds} s contra ${origin}.`);
const until = Date.now() + seconds * 1000;
await Promise.all(Array.from({ length: clients }, (_, i) => phone(i, opened.executionId, until)));

// Deja que el último sondeo rescate lo que quedó en cola y cuenta reportes trabados.
await sleep(2000);
await fetch(`${origin}/api/state`, { headers: bypass });
const db = new Client({ connectionString: directUrl });
await db.connect();
const stuck = await db.query(`SELECT count(*)::int AS n FROM reports WHERE "executionId"=$1 AND status='processing'`, [opened.executionId]);
const admitted = await db.query(`SELECT count(*)::int AS n FROM reports WHERE "executionId"=$1`, [opened.executionId]);
await db.end();

for (const kind of ["state", "page", "send"] as const) {
  const list = samples.filter(s => s.kind === kind);
  const ms = list.map(s => s.ms);
  const codes = Object.entries(list.reduce<Record<string, number>>((acc, s) => {
    const key = s.status >= 200 && s.status < 300 ? String(s.status) : `${s.status} ${s.code ?? ""}`.trim();
    acc[key] = (acc[key] ?? 0) + 1; return acc;
  }, {})).map(([k, v]) => `${k}×${v}`).join(", ");
  console.info(`${kind.padEnd(5)} n=${list.length} p50=${percentile(ms, 0.5).toFixed(0)} ms p95=${percentile(ms, 0.95).toFixed(0)} ms max=${percentile(ms, 1).toFixed(0)} ms  ${codes}`);
}
const storage = samples.filter(s => s.code === "STORAGE_UNAVAILABLE").length;
console.info(`Reportes admitidos: ${admitted.rows[0].n}. En procesamiento al terminar: ${stuck.rows[0].n}. STORAGE_UNAVAILABLE: ${storage}.`);
