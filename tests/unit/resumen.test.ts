import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize } from "../../src/components/rodrigo/resumen/model";

const actor = (name: string) => ({ id: `actor_${name}`, displayName: name });
const ev = (sequence: number, kind: string, extra: object = {}) =>
  ({ id: `event_${sequence}`, sequence, kind, actor: null, origin: "system", channel: "system", result: "recorded", narrativeAt: "2026-10-23T22:10:00Z", operationalAt: "2026-10-23T22:10:00Z", ...extra });
const state = (events: unknown[], extra: object = {}) =>
  ({ executionId: "execution_1", events, incidents: [], notifications: [], outgoingNoticeCount: 0, coverage: null, handoff: null, ...extra }) as never;

test("ejecución vacía: sin hechos y sin conteos inventados", () => {
  const s = summarize(state([]));
  assert.equal(s.empty, true);
  assert.equal(s.outgoingNotices, 0);
  assert.deepEqual(s.taken, []);
});

test("toma «Avisos a Rodrigo» del estado y lista los incidentes tomados", () => {
  const s = summarize(state(
    [ev(1, "report_admitted"), ev(2, "report_admitted"), ev(3, "incident_created"), ev(4, "incident_taken"), ev(5, "coverage_activated")],
    { outgoingNoticeCount: 2, incidents: [{ id: "i1", status: "taken", service: "facturacion", takenBy: actor("Tomás"), takenAt: "2026-10-23T22:12:00Z" }] },
  ));
  assert.equal(s.empty, false);
  assert.equal(s.outgoingNotices, 2);
  assert.deepEqual(s.taken.map(t => t.by), ["Tomás"]);
});

test("tomado no se presenta como resuelto", () => {
  const s = summarize(state([ev(1, "incident_taken")], { incidents: [{ id: "i1", status: "taken", service: "facturacion", takenBy: actor("Tomás"), takenAt: "2026-10-23T22:12:00Z" }] }));
  assert.match(s.taken[0].text, /tomó|tomado/i);
  assert.doesNotMatch(JSON.stringify(s), /resuelt/i);
});

test("el resumen de la noche no repite los conteos del proyector", () => {
  assert.deepEqual(Object.keys(summarize(state([ev(1, "report_admitted")]))).sort(), ["empty", "outgoingNotices", "taken"]);
});
