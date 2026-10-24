import "server-only";
import type { Actor, Event, Execution, Incident } from "@/lib/contracts/domain";
import type { ActorId, Instant, PreparationStatus } from "@/lib/contracts/core";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import type { ActorDTO, IncidentSummaryDTO, NotificationDTO, PublicEventDTO, PublicStateDTO } from "@/lib/contracts/public";
import { narrativeNow } from "@/lib/server/auth/service";
import { closingSummary, coverageDto, handoffSummary } from "@/lib/server/handoff/dto";
import { loadState } from "@/lib/server/handoff/engine";
import { incidentService, incidentSummary } from "@/lib/server/incidents/dto";

export const actorDto = (actors: readonly Actor[], id: ActorId): ActorDTO => ({ id, displayName: actors.find(a => a.id === id)?.displayName ?? "" });

/** Una nota guardada ya existe aunque la preparación del reset haya fallado: el estado dice lo que hay. */
export function preparationOf(execution: Execution, hasSavedNote: boolean): PreparationStatus {
  return hasSavedNote ? "ready" : execution.preparation;
}

function publicEvent(event: Event, actors: readonly Actor[]): PublicEventDTO {
  // Lista explícita: `details`, `principal`, correlación y entidad quedan fuera (S03).
  return {
    id: event.id, sequence: event.sequence, kind: event.kind,
    actor: event.actorId ? actorDto(actors, event.actorId) : null, origin: event.origin, channel: event.channel,
    operationalAt: event.operationalAt, narrativeAt: event.narrativeAt, result: event.result,
  };
}

/**
 * Construye el DTO público campo a campo dentro de la transacción de lectura. Nunca serializa entidades:
 * ni tickets (del cierre en borrador solo van conteos), ni notas, ni textos de reporte, ni concesiones, ni destinos de aviso.
 */
export async function buildPublicState(tx: TransactionRepositories, execution: Execution, now: Instant): Promise<PublicStateDTO> {
  const [actors, scenes, state, incidents, reports, notifications, events, tickets] = await Promise.all([
    tx.reference.actors(), tx.reference.scenes(), loadState(tx), tx.aggregates.incidents.list(), tx.aggregates.reports.list(),
    tx.aggregates.notifications.list(), tx.events.list(), tx.aggregates.tickets.list(),
  ]);
  const scene = scenes.find(s => s.id === execution.sceneId);
  const window = state?.window ?? (await tx.reference.windows())[0] ?? null;
  const attempts = new Map((await tx.aggregates.incidentAttempts.list()).map(a => [a.id, a]));
  const incidentDtos: IncidentSummaryDTO[] = [...incidents]
    .sort((a, b) => Date.parse(a.firstNarrativeAt) - Date.parse(b.firstNarrativeAt))
    .map((incident: Incident) => incidentSummary(
      incident, incident.currentAttemptId ? attempts.get(incident.currentAttemptId) ?? null : null, actors,
      incidentService(incident, reports.find(r => r.id === incident.firstReportId) ?? null),
    ));
  const notificationDtos: NotificationDTO[] = [...notifications]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map(n => ({ id: n.id, recipient: actorDto(actors, n.recipientActorId), channel: n.channel, status: n.status }));
  return {
    audience: "public",
    executionId: execution.executionId,
    version: execution.version,
    scene: { id: execution.sceneId, label: scene?.label ?? "" },
    preparation: preparationOf(execution, Boolean(state?.handoff.savedSuggestion)),
    clocks: { operationalNow: now, narrativeNow: narrativeNow(execution, now), timeZone: "America/Santiago" },
    channelOpen: execution.channelOpen, channelOpenedAt: execution.channelOpenedAt,
    coverage: state ? coverageDto(state.coverage, state.window, actors) : null,
    handoff: state ? handoffSummary(state.handoff, state.attempt, actors) : null,
    // Solo conteos: ni referencias ni textos de tickets (decisión de Diego del 24-10-2026).
    closing: state ? closingSummary(state.handoff, state.window, tickets, actors) : null,
    incidents: incidentDtos,
    notifications: notificationDtos,
    events: events.map(e => publicEvent(e, actors)),
    // Intenciones de aviso al saliente, no despertares confirmados (C09).
    outgoingNoticeCount: window ? notifications.filter(n => n.recipientActorId === window.outgoingActorId).length : 0,
  };
}
