import assert from "node:assert/strict";
import { test } from "node:test";
import { freshest } from "../../src/lib/client/state/accept";
import {
  HIDDEN_INTERVAL_MS, MAX_BACKOFF_MS, combineCadence, nextDelay, refreshDecision, stateFingerprint,
} from "../../src/lib/client/state/sync";

const state = (over: Record<string, unknown> = {}) => ({
  executionId: "execution_1", version: 3, scene: { id: "scene_channel", label: "Canal" }, channelOpen: false,
  clocks: { operationalNow: "2026-10-23T22:00:00.000Z", narrativeNow: "2026-10-23T23:58:00.000Z", timeZone: "America/Santiago" },
  incidents: [], notifications: [], events: [], ...over,
}) as never;

test("la huella ignora los relojes y detecta cambios que no suben la versión de la ejecución", () => {
  const a = state();
  const later = state({ clocks: { operationalNow: "2026-10-23T22:00:05.000Z", narrativeNow: "2026-10-23T23:58:05.000Z", timeZone: "America/Santiago" } });
  assert.equal(stateFingerprint(a), stateFingerprint(later));
  // Un incidente escalado cambia su propia versión, no la de la ejecución.
  const escalated = state({ incidents: [{ id: "incident_1", version: 2, status: "awaiting_ack" }] });
  assert.notEqual(stateFingerprint(a), stateFingerprint(escalated));
  assert.notEqual(stateFingerprint(a), stateFingerprint(state({ channelOpen: true })));
});

test("varias pantallas en una pestaña comparten el ritmo más rápido", () => {
  assert.equal(combineCadence([]), null);
  assert.deepEqual(combineCadence([{ intervalMs: 4000, keepPaceHidden: false }, { intervalMs: 1000, keepPaceHidden: true }]),
    { intervalMs: 1000, keepPaceHidden: true });
});

test("con la pestaña oculta consulta más lento, salvo la que marca el ritmo de los plazos", () => {
  assert.equal(nextDelay({ intervalMs: 1000, keepPaceHidden: false, hidden: false, failures: 0 }), 1000);
  assert.equal(nextDelay({ intervalMs: 1000, keepPaceHidden: false, hidden: true, failures: 0 }), HIDDEN_INTERVAL_MS);
  assert.equal(nextDelay({ intervalMs: 1000, keepPaceHidden: true, hidden: true, failures: 0 }), 1000);
});

test("tras fallos espera más, con un tope corto para volver pronto", () => {
  const delays = [1, 2, 3, 4, 9].map(failures => nextDelay({ intervalMs: 1000, keepPaceHidden: true, hidden: false, failures }));
  assert.deepEqual(delays, [1000, 2000, 4000, MAX_BACKOFF_MS, MAX_BACKOFF_MS]);
  // Nunca más rápido que el ritmo pedido.
  assert.equal(nextDelay({ intervalMs: 4000, keepPaceHidden: false, hidden: false, failures: 1 }), 4000);
});

test("la vista servidor se rehace solo si cambió algo o tocó la relectura de seguridad", () => {
  const base = { fingerprint: "b", rendered: "b", sinceRefreshMs: 1000, safetyMs: 10_000, hidden: false };
  assert.equal(refreshDecision({ ...base, rendered: null }), "baseline");
  assert.equal(refreshDecision(base), null);
  assert.equal(refreshDecision({ ...base, fingerprint: "c" }), "changed");
  assert.equal(refreshDecision({ ...base, sinceRefreshMs: 10_000 }), "safety");
  assert.equal(refreshDecision({ ...base, sinceRefreshMs: 60_000, hidden: true }), null);
  assert.equal(refreshDecision({ ...base, fingerprint: "c", hidden: true }), "changed");
});

test("una vista usa el snapshot más nuevo entre el de la página y el sondeo", () => {
  const page = state({ version: 3 });
  assert.equal(freshest(page, null), page);
  const newer = state({ version: 4, clocks: { operationalNow: "2026-10-23T22:00:01.000Z", narrativeNow: "x", timeZone: "America/Santiago" } });
  assert.equal(freshest(page, newer), newer);
  const older = state({ version: 2 });
  assert.equal(freshest(page, older), page);
});
