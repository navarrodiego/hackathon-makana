import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ActorId, HandoffId, Instant } from "@/lib/contracts/core";
import type { Actor, Execution, Incident, IncidentAttempt, NotificationIntent, Report, Ticket } from "@/lib/contracts/domain";
import type { ErrorCode, ServiceResult } from "@/lib/contracts/http";
import type { ChannelViewDTO, IncidentSummaryDTO, ReportReceiptDTO } from "@/lib/contracts/public";
import type { ControlViewDTO, HandoffPackageDTO, NoteDTO, RodrigoViewDTO, TicketDTO } from "@/lib/contracts/private";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import { LIMITS } from "@/lib/contracts/core";
import { coverageDto, handoffSummary } from "@/lib/server/handoff/dto";
import { loadState } from "@/lib/server/handoff/engine";
import { incidentService, incidentSummary } from "@/lib/server/incidents/dto";
import { actorDto, buildPublicState, preparationOf } from "./public";
import { reportStatus } from "./reports";

const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const ticketDto = (t: Ticket): TicketDTO => ({ id: t.id, reference: t.reference, text: t.text, disposition: t.disposition, reason: t.reason });

async function currentExecution(tx: TransactionRepositories, context: CommandContext): Promise<Execution | null> {
  return tx.aggregates.executions.get(context.executionId);
}

/** `/rodrigo`: borrador, nota guardada y estado propio. Solo el saliente de la ejecución o control en su nombre. */
export async function outgoingView(tx: TransactionRepositories, context: CommandContext): Promise<ServiceResult<RodrigoViewDTO>> {
  const p = context.principal;
  if ((p.kind !== "outgoing" && p.kind !== "control") || !context.actorId) return fail("FORBIDDEN");
  const [execution, state, actors, tickets, incidents, reports, attempts] = await Promise.all([
    currentExecution(tx, context), loadState(tx), tx.reference.actors(), tx.aggregates.tickets.list(), tx.aggregates.incidents.list(),
    tx.aggregates.reports.list(), tx.aggregates.incidentAttempts.list(),
  ]);
  if (!execution || !state) return fail("NOT_FOUND");
  if (state.handoff.outgoingActorId !== context.actorId) return fail("FORBIDDEN");
  const saved = state.handoff.savedSuggestion;
  const note: NoteDTO = {
    status: preparationOf(execution, Boolean(saved)),
    saved: saved ? { output: saved.output, provenance: saved.provenance, generatedAt: saved.generatedAt } : null,
  };
  const ordered = state.handoff.ticketIds.map(id => tickets.find(t => t.id === id)).filter((t): t is Ticket => Boolean(t));
  const active: IncidentSummaryDTO[] = incidents
    .filter(i => i.status !== "taken")
    .map(i => incidentSummary(i, attempts.find(a => a.id === i.currentAttemptId) ?? null, actors, incidentService(i, reports.find(r => r.id === i.firstReportId) ?? null)));
  return { ok: true, value: {
    audience: "outgoing", executionId: execution.executionId, actorId: context.actorId, draftVersion: state.handoff.version,
    tickets: ordered.map(ticketDto), note,
    handoff: state.handoff.status === "draft" ? null : handoffSummary(state.handoff, state.attempt, actors),
    coverage: coverageDto(state.coverage, state.window, actors), activeIncidents: active,
  } };
}

/**
 * `/relevo/[id]`: paquete enviado al candidato vigente. Un candidato derivado, un relevo en borrador u otro id
 * se rechazan sin devolver pendientes ni nota (S04).
 */
export async function recipientView(tx: TransactionRepositories, context: CommandContext, id: HandoffId): Promise<ServiceResult<HandoffPackageDTO>> {
  const p = context.principal;
  if ((p.kind !== "recipient" && p.kind !== "control") || !context.actorId) return fail("FORBIDDEN");
  const [state, actors, tickets] = await Promise.all([loadState(tx), tx.reference.actors(), tx.aggregates.tickets.list()]);
  if (!state || state.handoff.id !== id || state.handoff.status === "draft") return fail("NOT_FOUND");
  if (!state.attempt || state.attempt.candidateActorId !== context.actorId || state.handoff.currentAttemptId !== state.attempt.id) return fail("CANDIDATE_STALE");
  const ordered = state.handoff.ticketIds.map(t => tickets.find(x => x.id === t)).filter((t): t is Ticket => Boolean(t));
  return { ok: true, value: {
    audience: "recipient", executionId: context.executionId, handoff: handoffSummary(state.handoff, state.attempt, actors),
    outgoing: actorDto(actors, state.handoff.outgoingActorId), tickets: ordered.map(ticketDto), note: state.handoff.note,
    coverage: coverageDto(state.coverage, state.window, actors),
  } };
}

/** `/control`: estado público más lo necesario para operar. No incluye tokens ni destinos de aviso. */
export async function controlView(tx: TransactionRepositories, context: CommandContext, now: Instant): Promise<ServiceResult<ControlViewDTO>> {
  if (context.principal.kind !== "control") return fail("FORBIDDEN");
  const execution = await currentExecution(tx, context);
  if (!execution) return fail("NOT_FOUND");
  const [state, scenes, actors] = await Promise.all([buildPublicState(tx, execution, now), tx.reference.scenes(), tx.reference.actors()]);
  return { ok: true, value: {
    audience: "control", state, preparation: state.preparation,
    sceneOptions: scenes.map(s => ({ id: s.id, label: s.label, narrativeAt: s.narrativeAt })),
    representedActors: actors.map(a => actorDto(actors, a.id)),
  } };
}

export interface ReceiptSources {
  readonly incidents: readonly Incident[]; readonly attempts: readonly IncidentAttempt[];
  readonly notifications: readonly NotificationIntent[]; readonly actors: readonly Actor[];
}
export function receipt(report: Report, execution: Execution, tx: ReceiptSources): ReportReceiptDTO {
  const incident = report.incidentId ? tx.incidents.find(i => i.id === report.incidentId) ?? null : null;
  const attempt = incident?.currentAttemptId ? tx.attempts.find(a => a.id === incident.currentAttemptId) ?? null : null;
  const name = (id: ActorId | null | undefined) => id ? actorDto(tx.actors, id).displayName || null : null;
  const intents = incident ? tx.notifications.filter(n => n.subject.kind === "incident" && n.subject.id === incident.id) : [];
  const latest = [...intents].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const status = reportStatus(report, incident);
  const output = report.classification?.output ?? null;
  return {
    audience: "reporter", executionId: execution.executionId, reportId: report.id, text: report.text, status,
    classificationMode: report.classification?.mode ?? "pending", incidentId: incident?.id ?? null,
    duplicate: incident ? incident.firstReportId !== report.id : false,
    notificationStatus: !latest || latest.status === "discarded" ? "none" : latest.status,
    // La próxima atención de un diferible la define la política; sin dato guardado no se inventa una hora.
    nextAttentionAt: report.decision?.route === "queue" ? report.decision.nextAttentionAt : null,
    // Quién tiene el aviso ahora y quién lo tomó; tomar no es resolver.
    notifiedTo: incident && !incident.takenBy ? name(attempt?.candidateActorId) : null,
    takenBy: name(incident?.takenBy),
    classified: report.classification?.mode === "model" && output && status !== "out_of_scope"
      ? { service: output.service, condition: output.condition, scope: output.scope } : null,
    // Clasificaciones guardadas antes de v2 no traen el campo.
    physicalEmergency: output?.physicalEmergency === true,
  };
}

/** `/canal`: solo los reportes de la sesión autorizada. Nunca los de otras personas. */
export async function ownReportsView(tx: TransactionRepositories, context: CommandContext): Promise<ServiceResult<ChannelViewDTO>> {
  const p = context.principal;
  if (p.kind !== "reporter") return fail("FORBIDDEN");
  const [execution, reports, incidents, attempts, notifications, actors] = await Promise.all([
    currentExecution(tx, context), tx.aggregates.reports.list(), tx.aggregates.incidents.list(), tx.aggregates.incidentAttempts.list(),
    tx.aggregates.notifications.list(), tx.reference.actors(),
  ]);
  if (!execution) return fail("NOT_FOUND");
  const own = reports.filter(r => r.sessionId === p.sessionId).sort((a, b) => a.admissionSequence - b.admissionSequence);
  return { ok: true, value: {
    audience: "reporter", executionId: execution.executionId, channelOpen: execution.channelOpen, channelOpenedAt: execution.channelOpenedAt, lobbyEndsAt: execution.lobbyEndsAt,
    remainingSessionReports: Math.max(0, LIMITS.reportsPerSession - own.length),
    remainingExecutionReports: Math.max(0, LIMITS.reportsPerExecution - execution.admittedReports),
    ownReports: own.map(r => receipt(r, execution, { incidents, attempts, notifications, actors })),
  } };
}
