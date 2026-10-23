import type {
  ActorId, CorrelationId, ExecutionId, HandoffAttemptId, HandoffId, IncidentAttemptId,
  IncidentId, Instant, Origin, ReportSessionId, Version,
} from "./core";
import type { RouteKey, ServiceResult } from "./http";

export type RecipientScope =
  | { readonly entity: "handoff"; readonly entityId: HandoffId; readonly attemptId: HandoffAttemptId; readonly actions: readonly ("read_handoff" | "accept_handoff" | "reject_handoff")[] }
  | { readonly entity: "incident"; readonly entityId: IncidentId; readonly attemptId: IncidentAttemptId; readonly actions: readonly "take_incident"[] };
export interface RecipientGrant {
  readonly executionId: ExecutionId; readonly actorId: ActorId; readonly scope: RecipientScope;
  readonly credentialHash: string; readonly issuedAt: Instant; readonly expiresAt: Instant;
}
export type Principal =
  | { readonly kind: "outgoing"; readonly actorId: ActorId }
  | { readonly kind: "control"; readonly operatorId: "demo_control" }
  | { readonly kind: "recipient"; readonly actorId: ActorId; readonly grant: RecipientGrant }
  | { readonly kind: "reporter"; readonly sessionId: ReportSessionId }
  | { readonly kind: "system" };
/** Exclusivo de consumidores servidor; no se acepta desde JSON ni prueba autenticación por sí solo. */
export interface CommandContext {
  readonly executionId: ExecutionId; readonly executionVersion: Version; readonly principal: Principal;
  readonly actorId: ActorId | null; readonly origin: Origin;
  readonly operationalNow: Instant; readonly narrativeNow: Instant; readonly correlationId: CorrelationId;
}
export interface AuthorizationInput {
  readonly route: RouteKey | "read_outgoing" | "read_handoff" | "read_control" | "read_own_reports";
  readonly executionId: ExecutionId; readonly authorizationHeader: string | null;
  readonly sessionCookie: string | null; readonly originHeader: string | null;
  readonly recipientLinkToken?: string;
  readonly entityId?: HandoffId | IncidentId;
  readonly attemptId?: HandoffAttemptId | IncidentAttemptId;
  readonly representedActorId?: ActorId;
}
export interface AuthorizationService {
  authorize(input: AuthorizationInput): Promise<ServiceResult<CommandContext>>;
  issueRecipientGrant(context: CommandContext, actorId: ActorId, scope: RecipientScope): Promise<ServiceResult<{
    readonly grant: RecipientGrant;
    /** Solo transporte privado/vista autorizada; nunca eventos, logs o estado público. */
    readonly opaqueToken: string;
  }>>;
}
export const SECURITY = {
  sessionCookieName: "relevo_session", sameSite: "lax", httpOnly: true,
  tokenEntropyBytes: 32, credentialHash: "sha256", cacheControl: "no-store",
  referrerPolicy: "no-referrer", browserPostContentType: "application/json",
  outgoingUsernameVariable: "RODRIGO_USERNAME", outgoingSecretVariable: "RODRIGO_SECRET",
  controlUsernameVariable: "CONTROL_USERNAME", controlSecretVariable: "CONTROL_SECRET",
  allowedOriginVariable: "APP_ORIGIN",
  /** Lo envía el formulario de /canal: con él, POST /api/messages solo acepta la cookie de sesión e ignora Basic. */
  publicSubmitHeader: "x-relevo-canal",
} as const;

/** Entrada GET del canal: reutiliza sesión válida o emite una cookie nueva; no envía reportes. */
export interface PublicSessionService {
  enter(existingCookie: string | null, operationalNow: Instant): Promise<ServiceResult<{
    readonly sessionId: ReportSessionId;
    readonly expiresAt: Instant;
    /** null si se reutilizó la cookie; solo se usa en Set-Cookie, nunca en un DTO. */
    readonly newOpaqueCookie: string | null;
  }>>;
}
