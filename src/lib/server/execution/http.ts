import "server-only";
import { randomUUID } from "node:crypto";
import type { AuthorizationService, CommandContext } from "@/lib/contracts/auth";
import type { CorrelationId } from "@/lib/contracts/core";
import type { ChangeQr, ChangeScene, ErrorCode, RequestValidator, ResetExecution } from "@/lib/contracts/http";
import { failure, success } from "@/lib/server/http/errors";
import { authHeaders } from "@/lib/server/http/request";
import { gzipped, jsonResponse } from "@/lib/server/http/response";
import type { ExecutionRuntimeService } from "./index";

export interface ExecutionHttpDeps {
  readonly authorization: AuthorizationService;
  readonly service: ExecutionRuntimeService;
  readonly validator: RequestValidator;
  /** Trabajo posterior a la respuesta (en Next, `after`). Debe tragarse sus propios errores. */
  readonly afterResponse: (work: () => Promise<unknown>) => void;
}

const newCorrelation = () => `correlation_${randomUUID()}` as CorrelationId;
const fail = (code: ErrorCode, correlationId: CorrelationId) => jsonResponse(failure(code, correlationId));

/**
 * `GET /api/state`: público y saneado. Su único efecto es técnico: evalúa plazos vencidos (C07/C08). No acepta cuerpo
 * ni autenticación, y nada de lo que recibe cambia lo que evalúa.
 */
export async function handleState(deps: { readonly service: Pick<ExecutionRuntimeService, "evaluateCurrent"> }, request?: Request): Promise<Response> {
  const correlation = newCorrelation();
  try {
    const state = await deps.service.evaluateCurrent();
    return state.ok ? gzipped(jsonResponse(success(state.value, 200, correlation)), request) : fail(state.code, correlation);
  } catch {
    return fail("STORAGE_UNAVAILABLE", correlation);
  }
}

type CommandRoute = "POST /api/scene" | "POST /api/qr" | "POST /api/reset";

/** Orden de C11: formato → validación → autorización/origen → servicio. Solo control, con el origen del escenario. */
export async function handleCommand(deps: ExecutionHttpDeps, route: CommandRoute, request: Request): Promise<Response> {
  const early = newCorrelation();
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return fail("INVALID_INPUT", early);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", early); }
  // Un único literal evita instanciar el mapa completo de rutas (desbordaba la pila de tsc, como en T06).
  const parsed = deps.validator.parse(route as "POST /api/reset", { body, params: null });
  if (!parsed.ok) return fail(parsed.code, early);
  const input: ResetExecution & Partial<ChangeScene> & Partial<ChangeQr> = parsed.value.input;
  // La credencial de control no depende de la ejecución. En reset se autoriza contra la vigente y el servicio recibe la
  // ejecución que el cliente conoce: así un reintento tras un reset exitoso llega al replay idempotente en vez de
  // morir como ejecución retirada. Cualquier otra ejecución sigue fallando en el servicio.
  const known = route === "POST /api/reset" ? await deps.service.currentExecutionId().catch(() => null) : null;
  const authorized = await deps.authorization.authorize({ route, executionId: known ?? input.executionId, ...authHeaders(request) });
  if (!authorized.ok) return fail(authorized.code, early);
  const context: CommandContext = { ...authorized.value, executionId: input.executionId };
  try {
    if (route === "POST /api/scene") {
      const result = await deps.service.changeScene(context, input as ChangeScene);
      return result.ok ? jsonResponse(success(result.value, 200, context.correlationId)) : fail(result.code, context.correlationId);
    }
    if (route === "POST /api/qr") {
      const result = await deps.service.changeQr(context, input as ChangeQr);
      return result.ok ? jsonResponse(success(result.value, 200, context.correlationId)) : fail(result.code, context.correlationId);
    }
    const result = await deps.service.reset(context, input);
    if (!result.ok) return fail(result.code, context.correlationId);
    const next: CommandContext = { ...context, executionId: result.value.executionId, executionVersion: result.value.state.version, actorId: null, narrativeNow: result.value.state.clocks.narrativeNow };
    // La preparación se marca fuera de la transacción y después de responder (C09); sin IA en la demo.
    deps.afterResponse(() => deps.service.prepareNote(next));
    return jsonResponse(success(result.value, 201, context.correlationId));
  } catch {
    return fail("STORAGE_UNAVAILABLE", context.correlationId);
  }
}
