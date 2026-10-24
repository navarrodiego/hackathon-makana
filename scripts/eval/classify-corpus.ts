import { writeFileSync } from "node:fs";
import type { CommandContext } from "../../src/lib/contracts/auth";
import type { Report } from "../../src/lib/contracts/domain";
import { createClassificationService } from "../../src/lib/server/classification";
import { decide } from "../../src/lib/server/policy";
import { createOpenRouterProvider } from "../../src/lib/server/providers/openrouter/index";
import { CONFIGURATION } from "../../src/lib/server/providers/openrouter/prompts";
import { HELDOUT_CORPUS, LIVE_CORPUS, type LiveCase } from "../../tests/fixtures/classification/live-corpus";

/**
 * Mide la clasificación real (Jev + extractor) con mensajes cortos del público. Gasta crédito de OpenRouter:
 * exige el mismo doble opt-in que live.test.ts y no carga .env por su cuenta.
 *
 *   OPENROUTER_LIVE=1 OPENROUTER_SPEND_AUTHORIZED=1 OPENROUTER_API_KEY=... \
 *     node --conditions=react-server --import tsx scripts/eval/classify-corpus.ts --repeat 2 --burst 20 [--set heldout] --out <archivo.json>
 *
 * Solo guarda etiquetas, ruta y latencia; nunca headers ni respuestas crudas.
 */
if (process.env.OPENROUTER_LIVE !== "1" || process.env.OPENROUTER_SPEND_AUTHORIZED !== "1" || !process.env.OPENROUTER_API_KEY?.trim()) {
  throw new Error("Requiere OPENROUTER_LIVE=1, OPENROUTER_SPEND_AUTHORIZED=1 y OPENROUTER_API_KEY.");
}
const args = new Map(process.argv.slice(2).flatMap((a, i, all) => a.startsWith("--") ? [[a.slice(2), all[i + 1]]] : []));
const repeat = Number(args.get("repeat") ?? 2);
const burst = Number(args.get("burst") ?? 20);
const only = args.get("only")?.split(",");
const out = args.get("out");

const context = {
  executionId: "execution_eval", executionVersion: 1, principal: { kind: "system" }, actorId: null, origin: "web",
  operationalNow: "2026-10-24T22:00:00.000Z", narrativeNow: "2026-10-24T22:00:00.000Z", correlationId: "correlation_eval",
} as CommandContext;
const service = createClassificationService({ provider: createOpenRouterProvider() });

interface Run {
  id: string; latencyMs: number; mode: string; reason: string | null; route: string;
  service: string | null; condition: string | null; scope: string | null; pc: number | null;
  sufficient: boolean | null; manipulation: boolean | null; emergency: boolean | null; topic: string | null; noTi: number | null;
}
async function classify(item: LiveCase, n: number): Promise<Run> {
  const start = performance.now();
  const report = { id: `report_eval_${item.id}_${n}`, version: 1, text: item.text } as unknown as Report;
  const result = await service.classify({ ...context, correlationId: `correlation_eval_${item.id}_${n}` }, report);
  const latencyMs = Math.round(performance.now() - start);
  if (!result.ok) throw new Error(`clasificación rechazada: ${result.code}`);
  const value = result.value;
  const output = value.output;
  return {
    id: item.id, latencyMs, mode: value.mode, reason: value.mode === "degraded" ? value.reason : null, route: decide(value).route,
    service: output?.service ?? null, condition: output?.condition ?? null, scope: output?.scope ?? null, pc: output?.pc ?? null,
    sufficient: output?.sufficientInformation ?? null, manipulation: output?.manipulation ?? null,
    emergency: output?.physicalEmergency ?? null, topic: output?.topic ?? null, noTi: output?.noTiProbability ?? null,
  };
}

const PROVIDER_FAILURES = ["timeout", "provider_unavailable", "invalid_output"];
const corpus = args.get("set") === "heldout" ? HELDOUT_CORPUS : LIVE_CORPUS;
const cases = corpus.filter(item => !only || only.includes(item.id));
const runs: Run[] = [];
for (let n = 0; n < repeat; n++) {
  // Secuencial para medir latencia sin competir entre llamadas propias.
  for (const item of cases) runs.push(await classify(item, n));
}
const burstRuns = burst > 0
  ? await Promise.all(cases.slice(0, burst).map(item => classify(item, 100)))
  : [];

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
};
const routeOk = (item: LiveCase, run: Run) => run.route === item.expected || (item.acceptable ?? []).includes(run.route as never);
const byId = new Map(cases.map(item => [item.id, item]));
const groups = [...new Set(cases.map(item => item.group))];
const rows = groups.map(group => {
  const own = runs.filter(run => byId.get(run.id)!.group === group);
  return { group, runs: own.length,
    exact: own.filter(run => run.route === byId.get(run.id)!.expected).length,
    acceptable: own.filter(run => routeOk(byId.get(run.id)!, run)).length };
});
const tiCases = cases.filter(item => item.group.startsWith("ti_"));
const summary = {
  configuration: CONFIGURATION.id, repeat, cases: cases.length, runs: runs.length,
  routeExact: runs.filter(run => run.route === byId.get(run.id)!.expected).length,
  routeAcceptable: runs.filter(run => routeOk(byId.get(run.id)!, run)).length,
  serviceOk: runs.filter(run => { const s = byId.get(run.id)!.services; return s.length === 0 || (run.service !== null && s.includes(run.service as never)); }).length,
  serviceMeasured: runs.length,
  itSentOutOfScope: runs.filter(run => tiCases.some(item => item.id === run.id) && run.route === "out_of_scope").map(run => run.id),
  emergencyDetected: runs.filter(run => byId.get(run.id)!.emergency && run.emergency === true).length,
  emergencyRuns: runs.filter(run => byId.get(run.id)!.emergency).length,
  emergencyFalsePositives: runs.filter(run => !byId.get(run.id)!.emergency && run.emergency === true).map(run => run.id),
  unstable: cases.filter(item => new Set(runs.filter(run => run.id === item.id).map(run => run.route)).size > 1).map(item => item.id),
  providerFailures: runs.filter(run => run.reason && PROVIDER_FAILURES.includes(run.reason)).length,
  latencyP50: percentile(runs.map(run => run.latencyMs), 0.5), latencyP95: percentile(runs.map(run => run.latencyMs), 0.95),
  burst: { calls: burstRuns.length, providerFailures: burstRuns.filter(run => run.reason && PROVIDER_FAILURES.includes(run.reason)).length,
    latencyP95: percentile(burstRuns.map(run => run.latencyMs), 0.95) },
  groups: rows,
};
const misses = runs.filter(run => !routeOk(byId.get(run.id)!, run)).map(run => ({ ...run, text: byId.get(run.id)!.text, expected: byId.get(run.id)!.expected }));

console.log(JSON.stringify(summary, null, 2));
console.log("\nFallos de ruta:");
for (const miss of misses) {
  console.log(`${miss.id} «${miss.text}» esperado ${miss.expected} → ${miss.route} | ${miss.mode}${miss.reason ? `/${miss.reason}` : ""} ${miss.service}/${miss.condition}/${miss.scope} pc=${miss.pc} suf=${miss.sufficient} topic=${miss.topic} emerg=${miss.emergency}`);
}
if (out) writeFileSync(out, JSON.stringify({ summary, runs, burstRuns }, null, 2));
