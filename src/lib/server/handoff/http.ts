import "server-only";
import { randomUUID } from "node:crypto";
import type { AuthorizationService, CommandContext } from "@/lib/contracts/auth";
import type { CorrelationId, HandoffId, Instant } from "@/lib/contracts/core";
import type { ErrorCode, HandoffResultDTO, RequestValidator, RespondHandoff as RespondInput, SendHandoff as SendInput, ServiceResult } from "@/lib/contracts/http";
import type { HandoffService } from "@/lib/contracts/services";
import type { UnitOfWork } from "@/lib/contracts/repositories";
import { authHeaders } from "@/lib/server/http/request";
import { failure, success } from "@/lib/server/http/errors";
import { jsonResponse } from "@/lib/server/http/response";

export type HandoffRoute = "POST /api/handoff" | "POST /api/handoff/[id]/accept" | "POST /api/handoff/[id]/reject";
export interface HandoffHttpDeps {
  readonly store: UnitOfWork;
  readonly authorization: AuthorizationService;
  readonly service: HandoffService;
  readonly validator: RequestValidator;
  readonly now: () => Instant;
}

const newCorrelation = () => `correlation_${randomUUID()}` as CorrelationId;
const fail = (code: ErrorCode, correlationId: CorrelationId) => jsonResponse(failure(code, correlationId));

/**
 * Adaptador delgado (C11): JSON → validar → autorizar → servicio. El orden de errores sigue C11 salvo
 * lo que ya resolvió T05. Después de cualquier resultado se evalúan plazos vencidos; así una acción
 * tardía (410) deja registrada la derivación aunque nadie consulte el estado.
 */
export async function handleHandoffRequest(deps: HandoffHttpDeps, route: HandoffRoute, request: Request, rawParams: unknown): Promise<Response> {
  const correlation = newCorrelation();
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return fail("INVALID_INPUT", correlation);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", correlation); }
  // Un único literal evita instanciar el mapa completo de rutas en cada rama (desbordaba la pila de tsc).
  const parsed = deps.validator.parse(route as "POST /api/handoff", { body, params: rawParams });
  if (!parsed.ok) return fail(parsed.code, correlation);
  const input = parsed.value.input as unknown as SendInput & Partial<RespondInput>;
  const params = parsed.value.params as unknown as { id: HandoffId } | null;
  const authorized = await deps.authorization.authorize({
    route, executionId: input.executionId, ...authHeaders(request),
    entityId: params?.id, attemptId: input.attemptId, representedActorId: input.representedActorId,
  });
  if (!authorized.ok) return fail(authorized.code, correlation);
  const context = authorized.value;
  const result: ServiceResult<HandoffResultDTO> = route === "POST /api/handoff"
    ? await deps.service.send(context, input as SendInput)
    : route === "POST /api/handoff/[id]/accept"
      ? await deps.service.accept(context, params!.id, input as RespondInput)
      : await deps.service.reject(context, params!.id, input as RespondInput);
  await evaluateAfter(deps, context);
  if (!result.ok) return fail(result.code, context.correlationId);
  return jsonResponse(success(result.value, route === "POST /api/handoff" ? 201 : 200, context.correlationId));
}

async function evaluateAfter(deps: HandoffHttpDeps, context: CommandContext): Promise<void> {
  try {
    await deps.service.evaluateDeadlines({
      ...context, principal: { kind: "system" }, actorId: null, origin: "system", operationalNow: deps.now(),
      narrativeNow: context.narrativeNow, correlationId: newCorrelation(),
    });
  } catch { /* la respuesta ya está decidida; el siguiente GET de estado reevalúa */ }
}
