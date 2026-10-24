import type {
  ActorId, AttemptStatus, Channel, CorrelationId, CoverageId, CoverageStatus,
  EventId, ExecutionId, HandoffAttemptId, HandoffId, HandoffStatus, IncidentAttemptId,
  IncidentId, IncidentStatus, Instant, NarrativeAnchor, NotificationId, Origin,
  PreparationStatus, ReportId, ReportSessionId, Revision, SceneId, TicketDisposition,
  TicketId, Version, WindowId,
} from "./core";
import type { Classification, DegradedReason, EquivalenceKey, NoteOutput, PolicyDecision, ProviderProvenance } from "./classification";

export interface Execution extends Revision {
  readonly status: "active" | "superseded";
  readonly sceneId: SceneId;
  readonly anchor: NarrativeAnchor;
  readonly channelOpen: boolean;
  /** Cuándo pasó de cerrado a abierto; null con el canal cerrado. */
  readonly channelOpenedAt: Instant | null;
  /** Hasta cuándo se rechazan reportes del público (espera común); control puede alargarla. Null con el canal cerrado. */
  readonly lobbyEndsAt: Instant | null;
  /** Hasta cuándo el proyector muestra el QR grande; control puede alargarlo o volver a mostrarlo. Null con el canal cerrado. */
  readonly qrEndsAt: Instant | null;
  readonly admittedReports: number;
  readonly preparation: PreparationStatus;
  readonly createdAt: Instant;
  readonly supersededBy: ExecutionId | null;
}
export interface Scene { readonly id: SceneId; readonly order: number; readonly label: string; readonly narrativeAt: Instant }
export interface Actor { readonly id: ActorId; readonly displayName: string }
export interface CoverageWindow {
  readonly id: WindowId; readonly executionId: ExecutionId;
  readonly startsAt: Instant; readonly endsAt: Instant;
  readonly outgoingActorId: ActorId; readonly outgoingEndsAt: Instant;
  readonly incomingActorId: ActorId; readonly backupActorIds: readonly ActorId[];
  readonly coordinatorActorId: ActorId;
}
export interface Ticket extends Revision {
  readonly id: TicketId; readonly reference: string; readonly text: string;
  readonly suggestedDisposition: TicketDisposition | null;
  readonly disposition: TicketDisposition; readonly reason: string;
  readonly incidentId: IncidentId | null;
}
export interface Handoff extends Revision {
  readonly id: HandoffId; readonly windowId: WindowId; readonly outgoingActorId: ActorId;
  readonly status: HandoffStatus; readonly currentAttemptId: HandoffAttemptId | null;
  readonly ticketIds: readonly TicketId[]; readonly note: string;
  readonly savedSuggestion: StoredNote | null;
  readonly sentAt: Instant | null; readonly acceptedAt: Instant | null;
  readonly acceptedBy: ActorId | null; readonly effectiveAt: Instant;
}
export interface HandoffAttempt extends Revision {
  readonly id: HandoffAttemptId; readonly handoffId: HandoffId; readonly candidateActorId: ActorId;
  readonly position: number; readonly status: AttemptStatus;
  readonly requestedAt: Instant; readonly deadlineAt: Instant; readonly respondedAt: Instant | null;
}
export type Coverage = Revision & { readonly id: CoverageId; readonly windowId: WindowId } & (
  | { readonly status: "unconfirmed"; readonly actorId: null; readonly acceptedAt: null }
  | { readonly status: Exclude<CoverageStatus, "unconfirmed">; readonly actorId: ActorId; readonly acceptedAt: Instant }
);
export interface ReportSession {
  readonly id: ReportSessionId; readonly credentialHash: string; readonly expiresAt: Instant;
}
export interface Report extends Revision {
  readonly id: ReportId; readonly admissionSequence: number; readonly sessionId: ReportSessionId; readonly nickname: string; readonly text: string;
  readonly origin: "web" | "scenario"; readonly operationalAt: Instant; readonly narrativeAt: Instant;
  readonly correlationId: CorrelationId; readonly principalKey: string; readonly idempotencyKey: string;
  readonly status: "processing" | "completed"; readonly classification: Classification | null;
  readonly decision: PolicyDecision | null; readonly incidentId: IncidentId | null;
}
export interface Incident extends Revision {
  readonly id: IncidentId; readonly status: IncidentStatus; readonly firstReportId: ReportId;
  readonly equivalence: EquivalenceKey; readonly firstNarrativeAt: Instant;
  readonly currentAttemptId: IncidentAttemptId | null;
  readonly takenBy: ActorId | null; readonly takenAt: Instant | null;
}
export interface IncidentAttempt extends Revision {
  readonly id: IncidentAttemptId; readonly incidentId: IncidentId; readonly candidateActorId: ActorId;
  readonly position: number; readonly status: Exclude<AttemptStatus, "rejected">;
  readonly requestedAt: Instant; readonly deadlineAt: Instant; readonly respondedAt: Instant | null;
}
export type EventKind =
  | "execution_started" | "scene_changed" | "qr_extended" | "qr_shown" | "handoff_sent" | "handoff_accepted" | "handoff_rejected"
  | "handoff_expired" | "handoff_derived" | "coverage_activated" | "coverage_unconfirmed" | "outgoing_ended"
  | "report_admitted" | "report_classified" | "policy_decided" | "report_linked"
  | "incident_created" | "incident_taken" | "incident_escalated" | "incident_unacknowledged"
  | "notification_intended" | "notification_provider_accepted" | "notification_failed" | "notification_in_app";
export type EntityRef =
  | { readonly kind: "execution"; readonly id: ExecutionId }
  | { readonly kind: "handoff"; readonly id: HandoffId }
  | { readonly kind: "incident"; readonly id: IncidentId }
  | { readonly kind: "report"; readonly id: ReportId }
  | { readonly kind: "notification"; readonly id: NotificationId };
export type EventPrincipal =
  | { readonly kind: "actor"; readonly actorId: ActorId }
  | { readonly kind: "control"; readonly operatorId: "demo_control" }
  | { readonly kind: "reporter"; readonly sessionId: ReportSessionId }
  | { readonly kind: "system" };
export type EventDetails =
  | { readonly kind: "transition"; readonly from: string; readonly to: string }
  | { readonly kind: "classification"; readonly mode: Classification["mode"]; readonly reason: DegradedReason | null }
  | { readonly kind: "policy"; readonly decision: PolicyDecision }
  | { readonly kind: "notification"; readonly providerMessageId: string | null; readonly failure: "timeout" | "unavailable" | "rejected" | null }
  | { readonly kind: "record" };
export interface Event {
  readonly id: EventId; readonly executionId: ExecutionId; readonly sequence: number;
  readonly kind: EventKind; readonly entity: EntityRef; readonly entityVersion: Version;
  readonly actorId: ActorId | null; readonly principal: EventPrincipal; readonly origin: Origin; readonly channel: Channel;
  /** Detalles privados: nunca hacer spread en PublicEventDTO. */
  readonly details: EventDetails;
  readonly operationalAt: Instant; readonly narrativeAt: Instant; readonly correlationId: CorrelationId;
  /** Código de hecho observado; sin texto libre del reporte ni secretos. */
  readonly result: "recorded" | "provider_accepted" | "failed" | "taken";
}
export type NotificationSubject =
  | { readonly kind: "handoff"; readonly id: HandoffId; readonly attemptId: HandoffAttemptId }
  | { readonly kind: "incident"; readonly id: IncidentId; readonly attemptId: IncidentAttemptId }
  | { readonly kind: "coordination"; readonly entity: EntityRef };
export interface NotificationIntent extends Revision {
  readonly id: NotificationId; readonly subject: NotificationSubject; readonly recipientActorId: ActorId;
  readonly channel: "ntfy" | "in_app"; readonly logicalKey: string;
  readonly status: "pending" | "provider_accepted" | "in_app_recorded" | "failed" | "discarded";
  readonly createdAt: Instant;
}
export interface StoredNote extends Revision {
  readonly output: NoteOutput; readonly provenance: ProviderProvenance; readonly generatedAt: Instant;
}
/** Los nombres persistentes son acuerdos para T03, no tablas ya creadas. */
export const ENTITY_TABLES = {
  Execution: "executions", Scene: "scenes", Actor: "actors", CoverageWindow: "coverage_windows",
  Ticket: "tickets", Handoff: "handoffs", HandoffAttempt: "handoff_attempts", Coverage: "coverages",
  ReportSession: "report_sessions", RecipientGrant: "recipient_grants", Report: "reports", Classification: "report_classifications",
  PolicyDecision: "report_policy_decisions", Incident: "incidents", IncidentAttempt: "incident_attempts",
  Event: "events", NotificationIntent: "notification_intents", IdempotencyRecord: "idempotency_records",
} as const;
