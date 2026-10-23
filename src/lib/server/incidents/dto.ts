import type { Actor, Incident, IncidentAttempt } from "@/lib/contracts/domain";
import type { ActorId, Service } from "@/lib/contracts/core";
import type { IncidentSummaryDTO } from "@/lib/contracts/public";
import type { Report } from "@/lib/contracts/domain";

const actorDto = (actors: readonly Actor[], id: ActorId) => ({ id, displayName: actors.find(a => a.id === id)?.displayName ?? "" });

/** Servicio del hecho: de la clave de hechos o de la clasificación del primer reporte; nunca inventado. */
export function incidentService(incident: Incident, first: Report | null): Service {
  if (incident.equivalence.mode === "facts") return incident.equivalence.service;
  return first?.classification?.output?.service ?? "otro";
}

export function incidentSummary(incident: Incident, attempt: IncidentAttempt | null, actors: readonly Actor[], service: Service): IncidentSummaryDTO {
  const pending = attempt?.status === "pending" ? attempt : null;
  return {
    id: incident.id, version: incident.version, status: incident.status, service, attemptId: incident.currentAttemptId,
    candidate: attempt ? actorDto(actors, attempt.candidateActorId) : null, deadlineAt: pending?.deadlineAt ?? null,
    takenBy: incident.takenBy ? actorDto(actors, incident.takenBy) : null, takenAt: incident.takenAt,
  };
}
