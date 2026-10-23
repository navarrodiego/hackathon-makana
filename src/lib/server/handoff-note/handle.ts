import "server-only";
import type { AuthorizationService } from "@/lib/contracts/auth";
import type { CorrelationId } from "@/lib/contracts/core";
import type { ErrorCode } from "@/lib/contracts/http";
import type { HandoffNoteService } from "@/lib/contracts/services";
import { failure, success } from "@/lib/server/http/errors";
import { authHeaders } from "@/lib/server/http/request";
import { jsonResponse } from "@/lib/server/http/response";
import { createRequestValidator } from "@/lib/server/http/validate";

const ROUTE = "POST /api/handoff/suggest" as const;
const validator = createRequestValidator();

/**
 * Orden de C11: formato mínimo → autorización/origen → ejecución → servicio (replay, versión, estado).
 * El ID de correlación solo se conoce tras autorizar; antes se usa uno propio para el error.
 */
export interface SuggestDeps { readonly auth: AuthorizationService; readonly note: HandoffNoteService }

/** `resolve` es perezoso: el formato se valida antes de tocar base de datos o secretos. */
export async function handleSuggest(request: Request, resolve: () => SuggestDeps): Promise<Response> {
  const early = `correlation_${crypto.randomUUID()}` as CorrelationId;
  const reject = (code: ErrorCode, correlationId = early) => jsonResponse(failure(code, correlationId));

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reject("INVALID_INPUT");
  let body: unknown;
  try { body = await request.json(); } catch { return reject("INVALID_INPUT"); }
  const parsed = validator.parse(ROUTE, { body, params: null });
  if (!parsed.ok) return reject(parsed.code);
  const { input } = parsed.value;

  let deps: SuggestDeps;
  try { deps = resolve(); } catch { return reject("STORAGE_UNAVAILABLE"); }

  const headers = authHeaders(request);
  const authorized = await deps.auth.authorize({
    route: ROUTE, executionId: input.executionId, representedActorId: input.representedActorId, ...headers,
  });
  if (!authorized.ok) return reject(authorized.code);
  const context = authorized.value;

  const result = await deps.note.suggest(context, input, request.signal);
  if (!result.ok) return reject(result.code, context.correlationId);
  return jsonResponse(success(result.value, 200, context.correlationId));
}
