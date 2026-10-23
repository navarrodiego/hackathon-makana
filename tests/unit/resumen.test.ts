import assert from "node:assert/strict";
import { test } from "node:test";
import { morningEvents, summarize } from "../../src/components/rodrigo/resumen/model";

const actor = (name: string) => ({ id: `actor_${name}`, displayName: name });
const ev = (sequence: number, kind: string, extra: object = {}) =>
  ({ id: `event_${sequence}`, sequence, kind, actor: null, origin: "system", channel: "system", result: "recorded", narrativeAt: "2026-10-23T22:10:00Z", operationalAt: "2026-10-23T22:10:00Z", ...extra });
const state = (events: unknown[], extra: object = {}) =>
  ({ executionId: "execution_1", events, incidents: [], notifications: [], outgoingNoticeCount: 0, coverage: null, handoff: null, ...extra }) as never;

test("ejecución vacía: sin hechos y sin conteos inventados", () => {
  const s = summarize(state([]));
  assert.equal(s.empty, true);
  assert.equal(s.reportsAdmitted, 0);
  assert.equal(s.outgoingNotices, 0);
});

test("cuenta solo lo registrado y toma «Avisos a Rodrigo» del estado", () => {
  const s = summarize(state(
    [ev(1, "report_admitted"), ev(2, "report_admitted"), ev(3, "incident_created"), ev(4, "incident_taken"), ev(5, "coverage_activated")],
    { outgoingNoticeCount: 2, incidents: [{ id: "i1", status: "taken", service: "facturacion", takenBy: actor("Tomás"), takenAt: "2026-10-23T22:12:00Z" }] },
  ));
  assert.equal(s.empty, false);
  assert.equal(s.reportsAdmitted, 2);
  assert.equal(s.incidentsCreated, 1);
  assert.equal(s.outgoingNotices, 2);
  assert.deepEqual(s.taken.map(t => t.by), ["Tomás"]);
});

test("tomado no se presenta como resuelto", () => {
  const s = summarize(state([ev(1, "incident_taken")], { incidents: [{ id: "i1", status: "taken", service: "facturacion", takenBy: actor("Tomás"), takenAt: "2026-10-23T22:12:00Z" }] }));
  assert.match(s.taken[0].text, /tomó|tomado/i);
  assert.doesNotMatch(JSON.stringify(s), /resuelt/i);
});

test("acuse (incidente tomado) y cobertura se cuentan por separado", () => {
  const onlyTaken = summarize(state([ev(1, "incident_taken")]));
  assert.equal(onlyTaken.coverageActivated, 0);
  const onlyCoverage = summarize(state([ev(1, "coverage_activated")]));
  assert.equal(onlyCoverage.incidentsTaken, 0);
});

test("el filtro de mañana conserva cobertura, relevo, incidentes y avisos; quita ruido", () => {
  const events = [ev(1, "scene_changed"), ev(2, "report_classified"), ev(3, "handoff_accepted"), ev(4, "incident_taken"), ev(5, "notification_in_app"), ev(6, "policy_decided")];
  assert.deepEqual(morningEvents(events as never[] as { kind: never; sequence: number }[]).map(e => e.sequence), [3, 4, 5]);
});
