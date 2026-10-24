import type {
  ActorId, ClockSnapshot, CoverageStatus, EventId, ExecutionId, HandoffAttemptId, HandoffId,
  HandoffStatus, IncidentAttemptId, IncidentId, IncidentStatus, Instant, NotificationId,
  Origin, PreparationStatus, ReportId, SceneId, Service, Version, WindowId,
} from "./core";
import type { EventKind } from "./domain";

export interface ActorDTO { readonly id: ActorId; readonly displayName: string }
export type CoverageDTO = {
  readonly windowId: WindowId; readonly startsAt: Instant; readonly endsAt: Instant;
  readonly outgoingEndsAt: Instant;
} & (
  | { readonly status: "unconfirmed"; readonly actor: null }
  | { readonly status: Exclude<CoverageStatus, "unconfirmed">; readonly actor: ActorDTO }
);
export interface HandoffSummaryDTO {
  readonly id: HandoffId; readonly version: Version; readonly status: HandoffStatus;
  readonly attemptId: HandoffAttemptId | null; readonly candidate: ActorDTO | null;
  readonly deadlineAt: Instant | null; readonly acceptedAt: Instant | null; readonly effectiveAt: Instant;
}
export interface IncidentSummaryDTO {
  readonly id: IncidentId; readonly version: Version; readonly status: IncidentStatus;
  readonly service: Service; readonly attemptId: IncidentAttemptId | null;
  readonly candidate: ActorDTO | null; readonly deadlineAt: Instant | null;
  readonly takenBy: ActorDTO | null; readonly takenAt: Instant | null;
}
export interface NotificationDTO {
  readonly id: NotificationId; readonly recipient: ActorDTO; readonly channel: "ntfy" | "in_app";
  readonly status: "pending" | "provider_accepted" | "in_app_recorded" | "failed" | "discarded";
}
export interface PublicEventDTO {
  readonly id: EventId; readonly sequence: number; readonly kind: EventKind;
  readonly actor: ActorDTO | null; readonly origin: Origin;
  readonly channel: "web" | "ntfy" | "in_app" | "system";
  readonly operationalAt: Instant; readonly narrativeAt: Instant;
  readonly result: "recorded" | "provider_accepted" | "failed" | "taken";
}
/**
 * Cierre en borrador para la sala (decisión de Diego, 24-10-2026): quién entrega, a quién irá primero y conteos.
 * Sin referencias, textos ni razones de los pendientes, y sin la nota.
 */
export interface ClosingSummaryDTO {
  readonly outgoing: ActorDTO; readonly firstCandidate: ActorDTO;
  readonly pendingCount: number; readonly followUpCount: number;
}
/** Construir explícitamente esta lista; no serializar entidades ni usar spreads privados. */
export interface PublicStateDTO {
  readonly audience: "public";
  readonly executionId: ExecutionId; readonly version: Version;
  readonly scene: { readonly id: SceneId; readonly label: string };
  readonly preparation: PreparationStatus; readonly clocks: ClockSnapshot; readonly channelOpen: boolean;
  /** Cuándo se abrió el canal; el envío público empieza `LIMITS.channelLobbyMs` después. */
  readonly channelOpenedAt: Instant | null;
  readonly coverage: CoverageDTO | null; readonly handoff: HandoffSummaryDTO | null;
  /** Solo con el relevo en borrador; `null` en cuanto se envía. */
  readonly closing: ClosingSummaryDTO | null;
  readonly incidents: readonly IncidentSummaryDTO[]; readonly notifications: readonly NotificationDTO[];
  readonly events: readonly PublicEventDTO[];
  /** Derivado de intenciones de aviso a ese actor, no de despertares. */
  readonly outgoingNoticeCount: number;
}
export interface ReportReceiptDTO {
  readonly audience: "reporter"; readonly executionId: ExecutionId; readonly reportId: ReportId;
  /** Texto que envió esta misma sesión; se muestra escapado. */
  readonly text: string;
  readonly status: "processing" | "queued" | "review" | "incident";
  readonly classificationMode: "pending" | "model" | "degraded";
  readonly incidentId: IncidentId | null; readonly duplicate: boolean;
  readonly notificationStatus: "none" | "pending" | "provider_accepted" | "in_app_recorded" | "failed";
  readonly nextAttentionAt: Instant | null;
  /** Nombre de quien tiene el aviso vigente mientras nadie lo toma. */
  readonly notifiedTo: string | null;
  /** Nombre de quien tomó el incidente; tomar no es resolver. */
  readonly takenBy: string | null;
}
export interface ChannelViewDTO {
  readonly audience: "reporter"; readonly executionId: ExecutionId; readonly channelOpen: boolean;
  readonly channelOpenedAt: Instant | null;
  readonly remainingSessionReports: number; readonly remainingExecutionReports: number;
  readonly ownReports: readonly ReportReceiptDTO[];
}
