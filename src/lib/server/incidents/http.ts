import "server-only";
import { randomUUID } from "node:crypto";
import type { AuthorizationService, CommandContext } from "@/lib/contracts/auth";
import type { CorrelationId, IncidentId, Instant } from "@/lib/contracts/core";
import type { ErrorCode, RequestValidator, TakeIncident } from "@/lib/contracts/http";
import type { IncidentService } from "@/lib/contracts/services";
import { authHeaders } from "@/lib/server/http/request";
import { failure, success } from "@/lib/server/http/errors";
import { jsonResponse } from "@/lib/server/http/response";

export interface AckHttpDeps {
  readonly authorization: AuthorizationService;
  readonly service: IncidentService;
  readonly validator: RequestValidator;
  readonly now: () => Instant;
}

const newCorrelation = () => `correlation_${randomUUID()}` as CorrelationId;
const fail = (code: ErrorCode, correlationId: CorrelationId) => jsonResponse(failure(code, correlationId));

/**
 * `POST /api/ack/[id]` (C08/C11): JSON → validar → autorizar → tomar. Solo POST: un GET del enlace nunca acusa.
 * Tras cualquier resultado se evalúan plazos vencidos, así un acuse tardío (410) deja registrada la escalada.
 */
export async function handleAckRequest(deps: AckHttpDeps, request: Request, rawParams: unknown): Promise<Response> {
  const correlation = newCorrelation();
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return fail("INVALID_INPUT", correlation);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", correlation); }
  const parsed = deps.validator.parse("POST /api/ack/[id]", { body, params: rawParams });
  if (!parsed.ok) return fail(parsed.code, correlation);
  const input = parsed.value.input as TakeIncident;
  const params = parsed.value.params as { id: IncidentId };
  const authorized = await deps.authorization.authorize({
    route: "POST /api/ack/[id]", executionId: input.executionId, ...authHeaders(request),
    entityId: params.id, attemptId: input.attemptId, representedActorId: input.representedActorId,
  });
  if (!authorized.ok) return fail(authorized.code, correlation);
  const context = authorized.value;
  const result = await deps.service.take(context, params.id, input);
  await evaluateAfter(deps, context);
  if (!result.ok) return fail(result.code, context.correlationId);
  return jsonResponse(success(result.value, 200, context.correlationId));
}

async function evaluateAfter(deps: AckHttpDeps, context: CommandContext): Promise<void> {
  try {
    await deps.service.evaluateDeadlines({
      ...context, principal: { kind: "system" }, actorId: null, origin: "system", operationalNow: deps.now(),
      narrativeNow: context.narrativeNow, correlationId: newCorrelation(),
    });
  } catch { /* la respuesta ya está decidida; el siguiente GET de estado reevalúa */ }
}
