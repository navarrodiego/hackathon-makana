import "server-only";
import { randomUUID } from "node:crypto";
import { SECURITY, type AuthorizationService } from "@/lib/contracts/auth";
import type { CorrelationId } from "@/lib/contracts/core";
import type { ErrorCode, RequestValidator, SubmitReport } from "@/lib/contracts/http";
import type { MessageService } from "@/lib/contracts/services";
import { authHeaders } from "@/lib/server/http/request";
import { failure, success } from "@/lib/server/http/errors";
import { jsonResponse } from "@/lib/server/http/response";

export interface MessageHttpDeps {
  readonly authorization: AuthorizationService;
  readonly service: MessageService;
  readonly validator: RequestValidator;
}

const newCorrelation = () => `correlation_${randomUUID()}` as CorrelationId;
const fail = (code: ErrorCode, correlationId: CorrelationId) => jsonResponse(failure(code, correlationId));

/**
 * `POST /api/messages` (C08/C13): JSON → validar → autorizar (sesión pública o control) → admitir y decidir.
 * Una cookie ausente o vencida no crea sesión: la entrada es el GET de `/canal`.
 * Un envío del canal ignora el Basic que el navegador adjunta solo tras abrir `/control` o `/rodrigo` (C12).
 */
export async function handleMessageRequest(deps: MessageHttpDeps, request: Request): Promise<Response> {
  const correlation = newCorrelation();
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return fail("INVALID_INPUT", correlation);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", correlation); }
  const parsed = deps.validator.parse("POST /api/messages", { body, params: null });
  if (!parsed.ok) return fail(parsed.code, correlation);
  const input = parsed.value.input as SubmitReport;
  const headers = authHeaders(request);
  const fromChannel = request.headers.has(SECURITY.publicSubmitHeader);
  const authorized = await deps.authorization.authorize({
    route: "POST /api/messages", executionId: input.executionId, ...headers,
    ...(fromChannel ? { authorizationHeader: null, operatorCookies: undefined } : {}),
  });
  if (!authorized.ok) return fail(authorized.code, correlation);
  const result = await deps.service.submit(authorized.value, input);
  if (!result.ok) return fail(result.code, authorized.value.correlationId);
  return jsonResponse(success(result.value, 201, authorized.value.correlationId));
}
