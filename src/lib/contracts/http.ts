import type {
  ActorId, CorrelationId, ExecutionId, HandoffAttemptId, HandoffId, IncidentAttemptId,
  IncidentId, Mutation, SceneId, TicketDisposition, TicketId, Version, VersionedMutation,
} from "./core";
import type { CoverageDTO, HandoffSummaryDTO, IncidentSummaryDTO, PublicStateDTO, ReportReceiptDTO } from "./public";
import type { NoteDTO } from "./private";

export const ERROR_STATUS = {
  INVALID_INPUT: 400,
  AUTH_REQUIRED: 401, AUTH_INVALID: 401, AUTH_EXPIRED: 401,
  FORBIDDEN: 403, ORIGIN_REJECTED: 403,
  NOT_FOUND: 404,
  EXECUTION_STALE: 409, VERSION_CONFLICT: 409, CANDIDATE_STALE: 409, STATE_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409, OPERATION_PENDING: 409, CHANNEL_CLOSED: 409, CHANNEL_WAITING: 409,
  ACTION_EXPIRED: 410, QUOTA_EXCEEDED: 429,
  PROVIDER_FAILED: 502, STORAGE_UNAVAILABLE: 503, AUTH_NOT_CONFIGURED: 503, PROVIDER_TIMEOUT: 504,
} as const;
export type ErrorCode = keyof typeof ERROR_STATUS;
export type ApiFailure<C extends ErrorCode = ErrorCode> = {
  [K in C]: { readonly status: typeof ERROR_STATUS[K]; readonly body: {
    readonly ok: false; readonly error: { readonly code: K; readonly message: string };
    readonly correlationId: CorrelationId;
  } }
}[C];
export interface ApiSuccess<T, S extends 200 | 201 = 200 | 201> {
  readonly status: S;
  readonly body: { readonly ok: true; readonly data: T; readonly correlationId: CorrelationId };
}
export type ServiceResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: ErrorCode };
/** Solo control puede representar actor; auth valida esta solicitud y fija el origen. */
export interface ScenarioActor { readonly representedActorId?: ActorId }
export interface SendHandoff extends VersionedMutation, ScenarioActor {
  readonly handoffId: HandoffId; readonly note: string;
  readonly tickets: readonly { readonly ticketId: TicketId; readonly disposition: TicketDisposition; readonly reason: string }[];
}
export interface SuggestHandoff extends VersionedMutation, ScenarioActor { readonly handoffId: HandoffId }
export interface RespondHandoff extends VersionedMutation, ScenarioActor { readonly attemptId: HandoffAttemptId }
export interface TakeIncident extends VersionedMutation, ScenarioActor { readonly attemptId: IncidentAttemptId }
export interface SubmitReport extends Mutation { readonly nickname: string; readonly text: string }
export interface ChangeScene extends VersionedMutation { readonly sceneId: SceneId; readonly channelOpen: boolean }
export type ResetExecution = VersionedMutation;
export interface HandoffResultDTO {
  readonly executionId: ExecutionId; readonly handoff: HandoffSummaryDTO; readonly coverage: CoverageDTO;
}
export interface SuggestionResultDTO {
  readonly executionId: ExecutionId; readonly handoffId: HandoffId; readonly version: Version; readonly note: NoteDTO;
}
export interface IncidentResultDTO { readonly executionId: ExecutionId; readonly incident: IncidentSummaryDTO }
export interface ResetResultDTO {
  readonly previousExecutionId: ExecutionId; readonly executionId: ExecutionId;
  readonly preparation: "pending"; readonly state: PublicStateDTO;
}
export type CommonError = "INVALID_INPUT" | "STORAGE_UNAVAILABLE";
export type AuthError = "AUTH_REQUIRED" | "AUTH_INVALID" | "AUTH_EXPIRED" | "FORBIDDEN" | "ORIGIN_REJECTED";
export type WriteError = CommonError | AuthError | "EXECUTION_STALE" | "IDEMPOTENCY_CONFLICT" | "OPERATION_PENDING";
export type TransitionError = WriteError | "NOT_FOUND" | "VERSION_CONFLICT" | "CANDIDATE_STALE" | "STATE_CONFLICT" | "ACTION_EXPIRED";
export interface Route<I, O, P, E extends ErrorCode, S extends 200 | 201> {
  readonly input: I; readonly output: O; readonly params: P; readonly errors: E; readonly successStatus: S;
}
export interface ApiRoutes {
  readonly "POST /api/messages": Route<SubmitReport, ReportReceiptDTO, null, WriteError | "CHANNEL_CLOSED" | "CHANNEL_WAITING" | "QUOTA_EXCEEDED", 201>;
  readonly "GET /api/state": Route<null, PublicStateDTO, null, CommonError, 200>;
  readonly "POST /api/handoff": Route<SendHandoff, HandoffResultDTO, null, TransitionError, 201>;
  readonly "POST /api/handoff/suggest": Route<SuggestHandoff, SuggestionResultDTO, null, TransitionError | "PROVIDER_FAILED" | "PROVIDER_TIMEOUT", 200>;
  readonly "POST /api/handoff/[id]/accept": Route<RespondHandoff, HandoffResultDTO, { readonly id: HandoffId }, TransitionError, 200>;
  readonly "POST /api/handoff/[id]/reject": Route<RespondHandoff, HandoffResultDTO, { readonly id: HandoffId }, TransitionError, 200>;
  readonly "POST /api/ack/[id]": Route<TakeIncident, IncidentResultDTO, { readonly id: IncidentId }, TransitionError, 200>;
  readonly "POST /api/scene": Route<ChangeScene, PublicStateDTO, null, WriteError | "NOT_FOUND" | "VERSION_CONFLICT" | "STATE_CONFLICT", 200>;
  readonly "POST /api/reset": Route<ResetExecution, ResetResultDTO, null, WriteError | "VERSION_CONFLICT", 201>;
}
export type RouteKey = keyof ApiRoutes;
export type ApiResponse<K extends RouteKey> = ApiSuccess<ApiRoutes[K]["output"], ApiRoutes[K]["successStatus"]> | ApiFailure<ApiRoutes[K]["errors"]>;
export type RouteExample<K extends RouteKey> = {
  readonly params: ApiRoutes[K]["params"]; readonly input: ApiRoutes[K]["input"];
  readonly response: ApiSuccess<ApiRoutes[K]["output"], ApiRoutes[K]["successStatus"]>;
};
export const ROUTE_ACCESS = {
  "POST /api/messages": ["public_session", "control"],
  "GET /api/state": ["public"],
  "POST /api/handoff": ["outgoing", "control"],
  "POST /api/handoff/suggest": ["outgoing", "control"],
  "POST /api/handoff/[id]/accept": ["recipient", "control"],
  "POST /api/handoff/[id]/reject": ["recipient", "control"],
  "POST /api/ack/[id]": ["recipient", "control"],
  "POST /api/scene": ["control"],
  "POST /api/reset": ["control"],
} as const satisfies Record<RouteKey, readonly string[]>;

/** Firmas para T05/T14; T01 no implementa validadores ejecutables. */
export interface RequestValidator {
  parse<K extends RouteKey>(route: K, raw: unknown): ServiceResult<{
    readonly input: ApiRoutes[K]["input"];
    readonly params: ApiRoutes[K]["params"];
  }>;
}
