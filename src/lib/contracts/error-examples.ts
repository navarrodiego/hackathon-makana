/** Un ejemplo por código; datos sintéticos, sin credenciales. */
import type { ApiFailure, ErrorCode } from "./http";

export const errorExamples = {
  INVALID_INPUT: { status: 400, body: { ok: false, error: { code: "INVALID_INPUT", message: "Revisa los datos de la solicitud." }, correlationId: "correlation_example" } },
  AUTH_REQUIRED: { status: 401, body: { ok: false, error: { code: "AUTH_REQUIRED", message: "Falta autorización para esta acción." }, correlationId: "correlation_example" } },
  AUTH_INVALID: { status: 401, body: { ok: false, error: { code: "AUTH_INVALID", message: "La credencial no es válida para esta acción." }, correlationId: "correlation_example" } },
  AUTH_EXPIRED: { status: 401, body: { ok: false, error: { code: "AUTH_EXPIRED", message: "La credencial venció." }, correlationId: "correlation_example" } },
  FORBIDDEN: { status: 403, body: { ok: false, error: { code: "FORBIDDEN", message: "No tienes permiso para esta acción." }, correlationId: "correlation_example" } },
  ORIGIN_REJECTED: { status: 403, body: { ok: false, error: { code: "ORIGIN_REJECTED", message: "El origen de la solicitud no está autorizado." }, correlationId: "correlation_example" } },
  NOT_FOUND: { status: 404, body: { ok: false, error: { code: "NOT_FOUND", message: "El recurso no está disponible para esta solicitud." }, correlationId: "correlation_example" } },
  EXECUTION_STALE: { status: 409, body: { ok: false, error: { code: "EXECUTION_STALE", message: "La demo se reinició. Revisa la ejecución vigente." }, correlationId: "correlation_example" } },
  VERSION_CONFLICT: { status: 409, body: { ok: false, error: { code: "VERSION_CONFLICT", message: "El estado cambió. Revisa la versión vigente." }, correlationId: "correlation_example" } },
  CANDIDATE_STALE: { status: 409, body: { ok: false, error: { code: "CANDIDATE_STALE", message: "La solicitud ya fue derivada. Tu acción no se aplicó." }, correlationId: "correlation_example" } },
  STATE_CONFLICT: { status: 409, body: { ok: false, error: { code: "STATE_CONFLICT", message: "La acción no está disponible en el estado actual." }, correlationId: "correlation_example" } },
  IDEMPOTENCY_CONFLICT: { status: 409, body: { ok: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "La clave de esta operación ya se usó con otros datos." }, correlationId: "correlation_example" } },
  OPERATION_PENDING: { status: 409, body: { ok: false, error: { code: "OPERATION_PENDING", message: "Esta operación sigue en curso. Conserva su clave para consultar de nuevo." }, correlationId: "correlation_example" } },
  CHANNEL_CLOSED: { status: 409, body: { ok: false, error: { code: "CHANNEL_CLOSED", message: "El canal está cerrado para nuevos reportes." }, correlationId: "correlation_example" } },
  ACTION_EXPIRED: { status: 410, body: { ok: false, error: { code: "ACTION_EXPIRED", message: "Venció el plazo para esta acción. No se aplicó." }, correlationId: "correlation_example" } },
  QUOTA_EXCEEDED: { status: 429, body: { ok: false, error: { code: "QUOTA_EXCEEDED", message: "Se alcanzó el límite de reportes de la sesión o de esta ejecución." }, correlationId: "correlation_example" } },
  PROVIDER_FAILED: { status: 502, body: { ok: false, error: { code: "PROVIDER_FAILED", message: "No se pudo generar la sugerencia. Se conserva el borrador guardado." }, correlationId: "correlation_example" } },
  STORAGE_UNAVAILABLE: { status: 503, body: { ok: false, error: { code: "STORAGE_UNAVAILABLE", message: "No se pudo comprobar el guardado. Conserva la clave de la operación." }, correlationId: "correlation_example" } },
  PROVIDER_TIMEOUT: { status: 504, body: { ok: false, error: { code: "PROVIDER_TIMEOUT", message: "Se agotó el tiempo para generar la sugerencia. Se conserva el borrador guardado." }, correlationId: "correlation_example" } },
} as const satisfies { readonly [K in ErrorCode]: ApiFailure<K> };
