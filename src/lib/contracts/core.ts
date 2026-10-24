/** Identificadores opacos en el wire; T05 valida formato, no se derivan de nombres. */
export type Id<K extends string> = `${K}_${string}`;
export type ExecutionId = Id<"execution">;
export type SceneId = Id<"scene">;
export type ActorId = Id<"actor">;
export type WindowId = Id<"window">;
export type TicketId = Id<"ticket">;
export type HandoffId = Id<"handoff">;
export type HandoffAttemptId = Id<"handoff_attempt">;
export type CoverageId = Id<"coverage">;
export type ReportSessionId = Id<"session">;
export type ReportId = Id<"report">;
export type IncidentId = Id<"incident">;
export type IncidentAttemptId = Id<"incident_attempt">;
export type EventId = Id<"event">;
export type NotificationId = Id<"notification">;
export type CorrelationId = Id<"correlation">;
/** UTC ISO 8601 con milisegundos. La plantilla no reemplaza validación runtime. */
export type Instant = `${number}-${number}-${number}T${number}:${number}:${number}.${number}Z`;
/** Entero >= 1; aumenta con cada cambio persistido, nunca con un render. */
export type Version = number;
export type Origin = "web" | "scenario" | "ntfy_action" | "system";
export type Channel = "web" | "ntfy" | "in_app" | "system";
export interface Revision { readonly executionId: ExecutionId; readonly version: Version }
export interface Mutation { readonly executionId: ExecutionId; readonly idempotencyKey: string }
export interface VersionedMutation extends Mutation { readonly expectedVersion: Version }
/** version = revisión de la entidad de trabajo; no una revisión global ajena. */
export interface AsyncFence extends Revision {
  readonly correlationId: CorrelationId;
  readonly entity:
    | { readonly kind: "report"; readonly id: ReportId }
    | { readonly kind: "handoff"; readonly id: HandoffId }
    | { readonly kind: "execution"; readonly id: ExecutionId }
    | { readonly kind: "notification"; readonly id: NotificationId };
}
export interface ClockSnapshot {
  readonly operationalNow: Instant;
  readonly narrativeNow: Instant;
  readonly timeZone: "America/Santiago";
}
export interface NarrativeAnchor { readonly operationalAt: Instant; readonly narrativeAt: Instant }
export const LIMITS = {
  reportCharacters: 280, reportsPerSession: 5, reportsPerExecution: 150,
  candidateDeadlineMs: 30_000, tokenMaxAgeMs: 1_800_000,
  sessionMaxAgeMs: 43_200_000, equivalenceWindowMs: 600_000,
  classificationTimeoutMs: 6_000, classificationTimeoutMinMs: 1_000, classificationTimeoutMaxMs: 10_000, classificationStallMs: 30_000, noteWords: 60,
} as const;
export const POLICY_THRESHOLDS = { review: 0.40, notify: 0.70 } as const;
export const SERVICES = ["facturacion", "red_locales", "correo", "vpn", "impresora", "cuentas", "otro"] as const;
export type Service = typeof SERVICES[number];
export type Condition = "caida" | "degradacion" | "solicitud";
export type Scope = "persona" | "local_equipo" | "generalizado";
export type TicketDisposition = "puede_esperar" | "transferir";
export type HandoffStatus = "draft" | "awaiting_candidate" | "accepted" | "uncovered";
export type CoverageStatus = "unconfirmed" | "scheduled" | "active" | "ended";
export type IncidentStatus = "awaiting_ack" | "taken" | "unacknowledged";
export type AttemptStatus = "pending" | "accepted" | "rejected" | "expired";
export type PreparationStatus = "pending" | "ready" | "failed";
