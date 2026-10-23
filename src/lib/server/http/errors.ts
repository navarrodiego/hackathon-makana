import { ERROR_STATUS, type ApiFailure, type ApiSuccess, type ErrorCode } from "@/lib/contracts/http";
import type { CorrelationId } from "@/lib/contracts/core";

// Texto fijo por código: nunca incluye entrada, credenciales ni datos de otra entidad (C11).
const MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "Los datos enviados no son válidos. No se guardó ningún cambio.",
  AUTH_REQUIRED: "Falta la credencial para esta acción. No se guardó ningún cambio.",
  AUTH_INVALID: "La credencial no corresponde a esta acción. No se guardó ningún cambio.",
  AUTH_EXPIRED: "El enlace venció. No se guardó ningún cambio; pide uno nuevo.",
  FORBIDDEN: "Esta acción no está permitida para quien la solicita. No se guardó ningún cambio.",
  ORIGIN_REJECTED: "La solicitud no viene de la aplicación. No se guardó ningún cambio.",
  NOT_FOUND: "No se encontró lo que se pidió.",
  EXECUTION_STALE: "La demostración se reinició. Carga el estado actual antes de continuar.",
  VERSION_CONFLICT: "Esto cambió mientras lo revisabas. Carga el estado actual antes de continuar.",
  CANDIDATE_STALE: "Esta persona ya no es la candidata vigente. No se cambió la cobertura.",
  STATE_CONFLICT: "El estado actual no permite esta acción. No se guardó ningún cambio.",
  IDEMPOTENCY_CONFLICT: "Esa clave de operación ya se usó con otro contenido. No se guardó ningún cambio.",
  OPERATION_PENDING: "La misma operación sigue en curso. Espera su resultado antes de repetirla.",
  CHANNEL_CLOSED: "El canal está cerrado por ahora. No se recibió el reporte.",
  ACTION_EXPIRED: "El plazo para esta acción terminó. No se cambió la cobertura.",
  QUOTA_EXCEEDED: "Se alcanzó el límite de reportes. No se recibió este reporte.",
  PROVIDER_FAILED: "El servicio de sugerencias falló. Se conserva lo guardado antes.",
  STORAGE_UNAVAILABLE: "No se pudo guardar ni leer ahora. No se sabe si el cambio quedó registrado; revisa el estado antes de repetir.",
  PROVIDER_TIMEOUT: "El servicio de sugerencias tardó demasiado. Se conserva lo guardado antes.",
};

export function failure<C extends ErrorCode>(code: C, correlationId: CorrelationId): ApiFailure<C> {
  return { status: ERROR_STATUS[code], body: { ok: false, error: { code, message: MESSAGES[code] }, correlationId } } as ApiFailure<C>;
}

export function success<T, S extends 200 | 201>(data: T, status: S, correlationId: CorrelationId): ApiSuccess<T, S> {
  return { status, body: { ok: true, data, correlationId } };
}
