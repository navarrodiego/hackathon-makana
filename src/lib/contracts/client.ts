/** Entrada cliente explícita. No reexportar entidades, repositorios, tokens ni credenciales. */
export { LIMITS, POLICY_THRESHOLDS, SERVICES } from "./core";
export type {
  ActorId, ClockSnapshot, CoverageStatus, ExecutionId, HandoffAttemptId, HandoffId,
  IncidentAttemptId, IncidentId, Instant, ReportId, SceneId, TicketDisposition, TicketId, Version,
} from "./core";
export type {
  ActorDTO, ChannelViewDTO, CoverageDTO, HandoffSummaryDTO, IncidentSummaryDTO,
  NotificationDTO, PublicEventDTO, PublicStateDTO, ReportReceiptDTO,
} from "./public";
