import "server-only";
import {
  SECURITY, type AuthorizationInput, type AuthorizationService, type CommandContext, type OperatorRole, type Principal,
  type RecipientGrant, type RecipientScope,
} from "@/lib/contracts/auth";
import { LIMITS, type ActorId, type CorrelationId, type ExecutionId, type Instant, type Origin } from "@/lib/contracts/core";
import type { Execution } from "@/lib/contracts/domain";
import type { ErrorCode, ServiceResult } from "@/lib/contracts/http";
import type { CredentialReader, ExecutionReader } from "@/lib/contracts/repositories";
import { checkOrigin } from "@/lib/server/http/origin";
import { generateOpaqueToken, hashCredential, isWellFormedToken, parseBasic, parseBearer, secretsEqual } from "./credentials";
import { verifyOperatorToken } from "./operator-session";

export interface AuthConfig {
  /** Única contraseña de operador; undefined si falta o es demasiado corta (falla cerrada). */
  readonly operatorSecret: string | undefined;
  readonly appOrigin: string | undefined;
}
/** Lecturas de referencia de la ejecución; las respuestas nulas/falsas no revelan nada al cliente. */
export interface AuthDirectory {
  outgoingActorId(executionId: ExecutionId): Promise<ActorId | null>;
  actorExists(executionId: ExecutionId, actorId: ActorId): Promise<boolean>;
}
export interface AuthDeps {
  readonly executions: ExecutionReader;
  readonly credentials: CredentialReader;
  readonly directory: AuthDirectory;
  /** Persiste la concesión en su propia unidad de trabajo; los motores que ya tienen transacción usan buildRecipientGrant. */
  readonly persistGrant: (context: CommandContext, grant: RecipientGrant) => Promise<ServiceResult<null>>;
  readonly config: AuthConfig;
  readonly now: () => Instant;
  readonly correlationId: () => CorrelationId;
}

type Role = "outgoing" | "control" | "recipient" | "session";
type RecipientAction = "read_handoff" | "accept_handoff" | "reject_handoff" | "take_incident";
type AuthRoute = AuthorizationInput["route"];
interface Rule {
  readonly post: boolean;
  readonly roles: readonly Role[];
  readonly entity?: "handoff" | "incident";
  readonly action?: RecipientAction;
  /** Qué actor opera: el saliente de la ejecución, el candidato indicado por control, o ninguno. */
  readonly actor?: "outgoing" | "candidate";
}
const RULES: Partial<Record<AuthRoute, Rule>> = {
  "POST /api/messages": { post: true, roles: ["session", "control"] },
  "POST /api/handoff": { post: true, roles: ["outgoing", "control"], actor: "outgoing" },
  "POST /api/handoff/suggest": { post: true, roles: ["outgoing", "control"], actor: "outgoing" },
  "POST /api/handoff/[id]/accept": { post: true, roles: ["recipient", "control"], entity: "handoff", action: "accept_handoff", actor: "candidate" },
  "POST /api/handoff/[id]/reject": { post: true, roles: ["recipient", "control"], entity: "handoff", action: "reject_handoff", actor: "candidate" },
  "POST /api/ack/[id]": { post: true, roles: ["recipient", "control"], entity: "incident", action: "take_incident", actor: "candidate" },
  "POST /api/scene": { post: true, roles: ["control"] },
  "POST /api/qr": { post: true, roles: ["control"] },
  "POST /api/reset": { post: true, roles: ["control"] },
  read_outgoing: { post: false, roles: ["outgoing", "control"], actor: "outgoing" },
  read_handoff: { post: false, roles: ["recipient"], entity: "handoff", action: "read_handoff" },
  read_control: { post: false, roles: ["control"] },
  read_own_reports: { post: false, roles: ["session"] },
};

const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const at = (i: Instant) => Date.parse(i);
const BEARER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Hora narrativa 1:1 respecto del ancla de la ejecución (C14). */
export function narrativeNow(execution: Execution, operationalNow: Instant): Instant {
  const t = at(execution.anchor.narrativeAt) + (at(operationalNow) - at(execution.anchor.operationalAt));
  return new Date(t).toISOString() as Instant;
}

/**
 * Respaldo Basic para clientes sin navegador (C12): el usuario `rodrigo` o `control` elige el rol y la contraseña
 * es OPERATOR_SECRET. Se compara siempre la contraseña, para no filtrar por tiempo si el usuario existía.
 */
function matchBasic(header: string | null, config: AuthConfig): OperatorRole | "none" | "malformed" {
  const parsed = parseBasic(header);
  if (!parsed) return "malformed";
  const secretOk = secretsEqual(parsed.secret, config.operatorSecret);
  const role = (Object.keys(SECURITY.basicUsernames) as OperatorRole[]).find(r => SECURITY.basicUsernames[r] === parsed.username);
  return secretOk && role ? role : "none";
}

/**
 * Roles con cookie de operador válida. Rodrigo primero: si en el mismo navegador hay ambas sesiones, las acciones
 * de /rodrigo (las únicas rutas que admiten los dos roles y que control no usa) quedan atribuidas a Rodrigo.
 */
function operatorRolesFromCookies(cookies: AuthorizationInput["operatorCookies"], config: AuthConfig, nowMs: number): OperatorRole[] {
  if (!cookies) return [];
  return (["outgoing", "control"] as const).filter(r => verifyOperatorToken(cookies[r], r, config.operatorSecret, nowMs));
}

/** Alcance coherente con la entidad; la concesión de incidente nunca abre un paquete de relevo. */
function validScope(scope: RecipientScope): boolean {
  if (!scope.actions.length) return false;
  const idOk = (id: string, prefix: string) => id.startsWith(`${prefix}_`) && !id.startsWith(`${prefix}_attempt_`) && BEARER_ID.test(id);
  if (scope.entity === "incident") {
    return idOk(scope.entityId, "incident") && scope.attemptId.startsWith("incident_attempt_") && scope.actions.every(a => a === "take_incident");
  }
  return idOk(scope.entityId, "handoff") && scope.attemptId.startsWith("handoff_attempt_")
    && (scope.actions as readonly string[]).every(a => a === "read_handoff" || a === "accept_handoff" || a === "reject_handoff");
}

/** Sin escritura: para motores que ya tienen transacción y guardan la concesión con tx.credentials.saveGrant. */
export function buildRecipientGrant(context: CommandContext, actorId: ActorId, scope: RecipientScope):
  ServiceResult<{ readonly grant: RecipientGrant; readonly opaqueToken: string }> {
  if (context.principal.kind === "recipient" || context.principal.kind === "reporter") return fail("FORBIDDEN");
  if (!validScope(scope) || !actorId.startsWith("actor_")) return fail("INVALID_INPUT");
  const opaqueToken = generateOpaqueToken();
  const issuedAt = context.operationalNow;
  const grant: RecipientGrant = {
    executionId: context.executionId, actorId, scope, credentialHash: hashCredential(opaqueToken),
    issuedAt, expiresAt: new Date(at(issuedAt) + LIMITS.tokenMaxAgeMs).toISOString() as Instant,
  };
  return { ok: true, value: { grant, opaqueToken } };
}

export function createAuthorizationService(deps: AuthDeps): AuthorizationService {
  async function authorize(input: AuthorizationInput): Promise<ServiceResult<CommandContext>> {
    const rule = RULES[input.route];
    if (!rule) return fail("FORBIDDEN");
    try {
      const header = input.authorizationHeader;
      const bearerLike = header !== null && /^Bearer\s/i.test(header);
      if (rule.post) {
        const nativeAck = input.route === "POST /api/ack/[id]" && bearerLike;
        if (!checkOrigin({ origin: input.originHeader, appOrigin: deps.config.appOrigin, allowMissing: nativeAck })) return fail("ORIGIN_REJECTED");
      }
      const resolved = await resolvePrincipal(input, rule, header, bearerLike);
      if (!resolved.ok) return resolved;
      const execution = await deps.executions.current();
      if (!execution) return fail("STORAGE_UNAVAILABLE");
      if (execution.executionId !== input.executionId) return fail("EXECUTION_STALE");
      let principal = resolved.value.principal;
      let outgoingActor: ActorId | null = null;
      if (principal === "outgoing") {
        outgoingActor = await deps.directory.outgoingActorId(execution.executionId);
        if (!outgoingActor || input.representedActorId !== undefined) return fail("FORBIDDEN");
        principal = { kind: "outgoing", actorId: outgoingActor };
      }
      const actor = outgoingActor ? { ok: true as const, value: outgoingActor } : await resolveActor(input, rule, principal, execution.executionId);
      if (!actor.ok) return actor;
      const operationalNow = deps.now();
      const origin: Origin = principal.kind === "control" ? "scenario" : bearerLike && input.originHeader === null ? "ntfy_action" : "web";
      return { ok: true, value: {
        executionId: execution.executionId, executionVersion: execution.version, principal,
        actorId: actor.value, origin, operationalNow, narrativeNow: narrativeNow(execution, operationalNow), correlationId: deps.correlationId(),
      } };
    } catch {
      return fail("STORAGE_UNAVAILABLE");
    }
  }

  async function resolvePrincipal(input: AuthorizationInput, rule: Rule, header: string | null, bearerLike: boolean):
    Promise<ServiceResult<{ principal: Principal | "outgoing" }>> {
    if (bearerLike) return rule.roles.includes("recipient") ? recipientFromToken(input, rule, parseBearer(header)) : fail("FORBIDDEN");
    // La cookie de operador gana: una credencial Basic vieja guardada por el navegador no tapa una sesión válida.
    const cookieRoles = operatorRolesFromCookies(input.operatorCookies, deps.config, at(deps.now()));
    const cookieRole = cookieRoles.find(r => rule.roles.includes(r));
    if (cookieRole === "control") return { ok: true, value: { principal: { kind: "control", operatorId: "demo_control" } } };
    if (cookieRole === "outgoing") return { ok: true, value: { principal: "outgoing" } };
    if (header !== null) {
      const who = matchBasic(header, deps.config);
      if (who === "malformed" || who === "none") return fail("AUTH_INVALID");
      if (!rule.roles.includes(who)) return fail("FORBIDDEN");
      if (who === "control") return { ok: true, value: { principal: { kind: "control", operatorId: "demo_control" } } };
      return { ok: true, value: { principal: "outgoing" } };
    }
    if (rule.roles.includes("recipient") && input.recipientLinkToken !== undefined) {
      return recipientFromToken(input, rule, isWellFormedToken(input.recipientLinkToken) ? input.recipientLinkToken : null);
    }
    if (rule.roles.includes("session") && input.sessionCookie !== null) return sessionFromCookie(input.sessionCookie);
    // Hay una sesión válida, pero de otro rol (p. ej. Rodrigo abriendo control).
    return fail(cookieRoles.length ? "FORBIDDEN" : "AUTH_REQUIRED");
  }

  async function recipientFromToken(input: AuthorizationInput, rule: Rule, token: string | null): Promise<ServiceResult<{ principal: Principal }>> {
    if (!token) return fail("AUTH_INVALID");
    const grant = await deps.credentials.findGrant(hashCredential(token));
    if (!grant || grant.executionId !== input.executionId) return fail("AUTH_INVALID");
    if (at(deps.now()) >= at(grant.expiresAt)) return fail("AUTH_EXPIRED");
    if (at(grant.expiresAt) - at(grant.issuedAt) > LIMITS.tokenMaxAgeMs) return fail("AUTH_INVALID");
    const { scope } = grant;
    if (scope.entity !== rule.entity || input.entityId !== scope.entityId) return fail("AUTH_INVALID");
    if (rule.post ? input.attemptId !== scope.attemptId : input.attemptId !== undefined && input.attemptId !== scope.attemptId) return fail("AUTH_INVALID");
    if (!rule.action || !(scope.actions as readonly string[]).includes(rule.action)) return fail("FORBIDDEN");
    if (input.representedActorId !== undefined) return fail("FORBIDDEN");
    return { ok: true, value: { principal: { kind: "recipient", actorId: grant.actorId, grant } } };
  }

  async function sessionFromCookie(cookie: string): Promise<ServiceResult<{ principal: Principal }>> {
    if (!isWellFormedToken(cookie)) return fail("AUTH_INVALID");
    const session = await deps.credentials.findSession(hashCredential(cookie));
    if (!session) return fail("AUTH_INVALID");
    if (at(deps.now()) >= at(session.expiresAt)) return fail("AUTH_EXPIRED");
    return { ok: true, value: { principal: { kind: "reporter", sessionId: session.id } } };
  }

  async function resolveActor(input: AuthorizationInput, rule: Rule, principal: Principal, executionId: ExecutionId): Promise<ServiceResult<ActorId | null>> {
    if (principal.kind === "recipient") return { ok: true, value: principal.actorId };
    if (principal.kind === "reporter") return { ok: true, value: null };
    const represented = input.representedActorId;
    if (principal.kind !== "control") return fail("FORBIDDEN");
    // Control: nunca fija estados por su cuenta; solo representa a quien el servicio de dominio luego valida.
    if (rule.actor === "outgoing") {
      const id = await deps.directory.outgoingActorId(executionId);
      if (!id || (represented !== undefined && represented !== id)) return fail("FORBIDDEN");
      return { ok: true, value: id };
    }
    if (rule.actor === "candidate") {
      if (represented === undefined) return fail("INVALID_INPUT");
      return (await deps.directory.actorExists(executionId, represented)) ? { ok: true, value: represented } : fail("FORBIDDEN");
    }
    return represented === undefined ? { ok: true, value: null } : fail("FORBIDDEN");
  }

  return {
    authorize,
    async issueRecipientGrant(context, actorId, scope) {
      const built = buildRecipientGrant(context, actorId, scope);
      if (!built.ok) return built;
      const saved = await deps.persistGrant(context, built.value.grant);
      return saved.ok ? built : saved;
    },
  };
}
