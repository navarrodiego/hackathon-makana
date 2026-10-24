/** Ejemplos sintéticos compilados por typecheck. No ejecutan rutas, motores ni proveedores. */
import type { RouteExample } from "./http";
import type { CoverageDTO, HandoffSummaryDTO, IncidentSummaryDTO, PublicStateDTO, ReportReceiptDTO } from "./public";
import type { PageViewMap, NoteDTO } from "./private";
import type { EquivalenceKey } from "./classification";

export const coverageExample = {
  windowId: "window_example", status: "unconfirmed", actor: null,
  startsAt: "2026-10-24T01:10:00.000Z", endsAt: "2026-10-24T11:00:00.000Z", outgoingEndsAt: "2026-10-24T01:10:00.000Z",
} as const satisfies CoverageDTO;
export const handoffExample = {
  id: "handoff_example", version: 2, status: "awaiting_candidate",
  attemptId: "handoff_attempt_first", candidate: { id: "actor_incoming", displayName: "Paula" },
  deadlineAt: "2026-10-23T15:00:30.000Z", acceptedAt: null, effectiveAt: "2026-10-24T01:10:00.000Z",
} as const satisfies HandoffSummaryDTO;
export const incidentExample = {
  id: "incident_example", version: 2, status: "awaiting_ack", service: "facturacion",
  attemptId: "incident_attempt_first", candidate: { id: "actor_incoming", displayName: "Paula" },
  deadlineAt: "2026-10-23T15:01:00.000Z", takenBy: null, takenAt: null,
} as const satisfies IncidentSummaryDTO;
export const publicStateExample = {
  audience: "public", executionId: "execution_example", version: 1,
  scene: { id: "scene_closing", label: "Cierre" }, preparation: "ready",
  clocks: { operationalNow: "2026-10-23T15:00:00.000Z", narrativeNow: "2026-10-24T01:09:50.000Z", timeZone: "America/Santiago" },
  channelOpen: false, coverage: coverageExample, handoff: handoffExample, closing: null,
  incidents: [], notifications: [], events: [], outgoingNoticeCount: 0,
} as const satisfies PublicStateDTO;
export const receiptExample = {
  audience: "reporter", executionId: "execution_example", reportId: "report_example",
  status: "review", classificationMode: "degraded", incidentId: "incident_example", duplicate: false,
  notificationStatus: "pending", nextAttentionAt: null, classified: null, physicalEmergency: false,
} as const satisfies ReportReceiptDTO;
export const noteExample = {
  status: "ready", saved: {
    output: { suggestions: [
      { ticketId: "ticket_481", disposition: "puede_esperar", reason: "Afecta a una persona." },
      { ticketId: "ticket_477", disposition: "puede_esperar", reason: "Uso administrativo." },
      { ticketId: "ticket_470", disposition: "transferir", reason: "Revisar el próximo intento." },
      { ticketId: "ticket_466", disposition: "puede_esperar", reason: "Degradación localizada." },
      { ticketId: "ticket_462", disposition: "puede_esperar", reason: "Solicitud para el lunes." },
    ], note: "Revisa el próximo intento del respaldo a las 02:00." },
    provenance: { provider: "openrouter", api: "structured_chat", model: "fixture-no-provider-call", configurationId: "fixture-v1" },
    generatedAt: "2026-10-23T14:59:00.000Z",
  },
} as const satisfies NoteDTO;
const mutation = { executionId: "execution_example", idempotencyKey: "example-operation-1" } as const;
const versioned = { ...mutation, expectedVersion: 2 } as const;
const correlationId = "correlation_example" as const;
const handoffResult = { executionId: "execution_example", handoff: handoffExample, coverage: coverageExample } as const;
export const routeExamples = {
  "POST /api/messages": {
    params: null, input: { ...mutation, nickname: "Local ficticio", text: "No podemos emitir boletas en el local 12." },
    response: { status: 201, body: { ok: true, data: receiptExample, correlationId } },
  },
  "GET /api/state": {
    params: null, input: null, response: { status: 200, body: { ok: true, data: publicStateExample, correlationId } },
  },
  "POST /api/handoff": {
    params: null, input: { ...versioned, expectedVersion: 1, handoffId: "handoff_example", note: "Revisa el próximo intento del respaldo a las 02:00.", tickets: [
      { ticketId: "ticket_481", disposition: "puede_esperar", reason: "Afecta a una persona." },
      { ticketId: "ticket_477", disposition: "puede_esperar", reason: "Uso administrativo." },
      { ticketId: "ticket_470", disposition: "transferir", reason: "Revisar próximo intento." },
      { ticketId: "ticket_466", disposition: "puede_esperar", reason: "Servicio degradado para dos personas." },
      { ticketId: "ticket_462", disposition: "puede_esperar", reason: "Solicitud para el lunes." },
    ] },
    response: { status: 201, body: { ok: true, data: handoffResult, correlationId } },
  },
  "POST /api/handoff/suggest": {
    params: null, input: { ...versioned, handoffId: "handoff_example" },
    response: { status: 200, body: { ok: true, data: { executionId: "execution_example", handoffId: "handoff_example", version: 3, note: noteExample }, correlationId } },
  },
  "POST /api/handoff/[id]/accept": {
    params: { id: "handoff_example" }, input: { ...versioned, attemptId: "handoff_attempt_first" },
    response: { status: 200, body: { ok: true, data: {
      executionId: "execution_example",
      handoff: { ...handoffExample, version: 3, status: "accepted", acceptedAt: "2026-10-23T15:00:01.000Z", deadlineAt: null },
      coverage: { ...coverageExample, status: "scheduled", actor: { id: "actor_incoming", displayName: "Paula" } },
    }, correlationId } },
  },
  "POST /api/handoff/[id]/reject": {
    params: { id: "handoff_example" }, input: { ...versioned, attemptId: "handoff_attempt_first" },
    response: { status: 200, body: { ok: true, data: { ...handoffResult, handoff: {
      ...handoffExample, version: 3, attemptId: "handoff_attempt_backup",
      candidate: { id: "actor_backup", displayName: "Tomás" }, deadlineAt: "2026-10-23T15:00:31.000Z",
    } }, correlationId } },
  },
  "POST /api/ack/[id]": {
    params: { id: "incident_example" }, input: { ...versioned, attemptId: "incident_attempt_first" },
    response: { status: 200, body: { ok: true, data: { executionId: "execution_example", incident: {
      ...incidentExample, version: 3, status: "taken", deadlineAt: null,
      takenBy: { id: "actor_incoming", displayName: "Paula" }, takenAt: "2026-10-23T15:00:31.000Z",
    } }, correlationId } },
  },
  "POST /api/scene": {
    params: null, input: { ...versioned, sceneId: "scene_channel", channelOpen: true },
    response: { status: 200, body: { ok: true, data: { ...publicStateExample, version: 3,
      scene: { id: "scene_channel", label: "Canal" }, channelOpen: true,
      clocks: { ...publicStateExample.clocks, narrativeNow: "2026-10-24T01:10:00.000Z" },
    }, correlationId } },
  },
  "POST /api/reset": {
    params: null, input: versioned, response: { status: 201, body: { ok: true, data: {
      previousExecutionId: "execution_example", executionId: "execution_successor", preparation: "pending",
      state: { ...publicStateExample, executionId: "execution_successor", version: 1, preparation: "pending", handoff: null, coverage: null, channelOpen: false },
    }, correlationId } },
  },
} as const satisfies { readonly [K in keyof import("./http").ApiRoutes]: RouteExample<K> };
const ticketViewExamples = [
  { id: "ticket_481", reference: "#481", text: "Adjuntos de correo de una persona.", disposition: "puede_esperar", reason: "Afecta a una persona." },
  { id: "ticket_477", reference: "#477", text: "Impresora administrativa sin tóner.", disposition: "puede_esperar", reason: "Uso administrativo." },
  { id: "ticket_470", reference: "#470", text: "Respaldo fallido; próximo intento a las 02:00.", disposition: "transferir", reason: "Revisar próximo intento." },
  { id: "ticket_466", reference: "#466", text: "VPN lenta para dos personas.", disposition: "puede_esperar", reason: "Degradación localizada." },
  { id: "ticket_462", reference: "#462", text: "Cuenta para el lunes.", disposition: "puede_esperar", reason: "Solicitud para el lunes." },
] as const satisfies readonly import("./private").TicketDTO[];
export const pageExamples = {
  "/canal": { audience: "reporter", executionId: "execution_example", channelOpen: false, remainingSessionReports: 5, remainingExecutionReports: 50, ownReports: [] },
  "/rodrigo": {
    audience: "outgoing", executionId: "execution_example", actorId: "actor_outgoing", draftVersion: 1,
    tickets: ticketViewExamples, note: noteExample, handoff: handoffExample, coverage: coverageExample, activeIncidents: [],
  },
  "/relevo/[id]": {
    audience: "recipient", executionId: "execution_example", handoff: handoffExample,
    outgoing: { id: "actor_outgoing", displayName: "Rodrigo" }, tickets: ticketViewExamples, note: "Borrador ficticio para revisión.", coverage: coverageExample,
  },
  "/proyector": publicStateExample,
  "/control": { audience: "control", state: publicStateExample, preparation: "ready", sceneOptions: [], representedActors: [] },
} as const satisfies PageViewMap;
const sameFact = { mode: "facts", service: "facturacion", condition: "caida", scope: "local_equipo", location: "local 12", resource: "caja 2", problem: "no emite boletas" } as const satisfies EquivalenceKey;
/** Son expectativas para pruebas de T10, no resultados de un motor ejecutado. */
export const equivalenceScenarios = [
  { key: sameFact, first: "2026-10-24T06:00:00.000Z", next: "2026-10-24T06:09:59.999Z", expectedDuplicate: true },
  { key: sameFact, first: "2026-10-24T06:00:00.000Z", next: "2026-10-24T06:10:00.000Z", expectedDuplicate: false },
  { key: sameFact, first: "2026-10-24T06:00:00.000Z", next: "2026-10-24T06:10:00.001Z", expectedDuplicate: false },
  { key: { ...sameFact, location: "local 13" }, first: "2026-10-24T06:00:00.000Z", next: "2026-10-24T06:01:00.000Z", expectedDuplicate: false },
] as const;

export const classificationRequestExample = {
  task: "classification", input: { text: "La caja 2 del local 12 no emite boletas." },
  fence: { executionId: "execution_example", version: 1, correlationId: "correlation_example", entity: { kind: "report", id: "report_example" } },
} as const satisfies import("./classification").ProviderRequest;
export const classificationOutputExample = {
  service: "facturacion", condition: "caida", scope: "local_equipo", pc: 0.9,
  manipulation: false, blocksBilling: true, sufficientInformation: true,
  topic: "ti", noTiProbability: 0.01, physicalEmergency: false,
  evidence: { location: "local 12", resource: "caja 2", problem: "no emite boletas" },
} as const satisfies import("./classification").ClassificationOutput;
export const notificationResultExamples = [
  { kind: "provider_accepted", acceptedAt: "2026-10-23T15:00:00.000Z", providerMessageId: "fixture-provider-id" },
  { kind: "in_app_recorded", recordedAt: "2026-10-23T15:00:00.000Z" },
  { kind: "failed", reason: "timeout", retryable: true },
  { kind: "discarded", reason: "stale_execution" },
] as const satisfies readonly import("./services").NotificationDeliveryResult[];
