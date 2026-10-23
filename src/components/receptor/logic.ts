import type { HandoffPackageDTO } from "@/lib/contracts/private";
import type { ErrorCode } from "@/lib/contracts/http";

export type RespondAction = "accept" | "reject";
export type ReviewState = "awaiting" | "scheduled" | "active";

const KEY_CHARS = /[^A-Za-z0-9._-]/g;

/**
 * POST explícito (C08). El token viaja solo en Authorization, nunca en la URL. La clave de idempotencia es
 * estable por acción e intento: un doble toque o un reintento repite la misma operación, no una nueva.
 */
export function buildRespondRequest(action: RespondAction, pkg: HandoffPackageDTO, token: string) {
  const { handoff } = pkg;
  if (!handoff.attemptId) throw new Error("Sin intento vigente");
  const key = `${action}.${handoff.attemptId}`.replace(KEY_CHARS, "_").slice(0, 128);
  const init: RequestInit = {
    method: "POST", cache: "no-store", referrerPolicy: "no-referrer", credentials: "omit",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ executionId: pkg.executionId, attemptId: handoff.attemptId, expectedVersion: handoff.version, idempotencyKey: key }),
  };
  return { url: `/api/handoff/${encodeURIComponent(handoff.id)}/${action}`, init, key };
}

/** Derivado solo de lo registrado: «active» exige cobertura efectiva; «scheduled», aceptación. */
export function reviewState(pkg: HandoffPackageDTO): ReviewState {
  if (pkg.coverage.status === "active") return "active";
  if (pkg.handoff.status === "accepted" || pkg.coverage.status === "scheduled") return "scheduled";
  return "awaiting";
}

export type FailureKind = "link_invalid" | "link_expired" | "reassigned" | "stale_view" | "unavailable";
export interface FailureView { readonly kind: FailureKind; readonly title: string; readonly detail: string }

/** Mensajes de LANGUAGE: qué falló, qué se conserva y sin atribuir causas no observadas. */
export function failureView(code: ErrorCode): FailureView {
  switch (code) {
    case "CANDIDATE_STALE":
    case "ACTION_EXPIRED":
      return { kind: "reassigned", title: "Este relevo ya fue derivado", detail: "Tu respuesta no cambia la cobertura ni la asignación. No necesitas hacer nada más aquí." };
    case "AUTH_EXPIRED":
      return { kind: "link_expired", title: "El enlace venció", detail: "No se muestra el paquete. Pide un aviso nuevo a quien te envió el relevo." };
    case "AUTH_REQUIRED": case "AUTH_INVALID": case "FORBIDDEN": case "NOT_FOUND": case "ORIGIN_REJECTED":
      return { kind: "link_invalid", title: "Este enlace no permite abrir el relevo", detail: "No se muestra el paquete. Usa el enlace del aviso que recibiste." };
    case "VERSION_CONFLICT": case "STATE_CONFLICT": case "EXECUTION_STALE":
      return { kind: "stale_view", title: "El relevo cambió mientras lo revisabas", detail: "Recarga la página para ver su estado actual antes de responder." };
    default:
      return { kind: "unavailable", title: "No se pudo comprobar el relevo", detail: "No se confirmó ningún cambio. Si respondiste, repetir la acción es seguro: usa la misma clave y no duplica la respuesta." };
  }
}

const clock = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago" });
/** Hora de 24 h; es hora operacional, no el reloj narrativo del escenario. */
export function formatClock(instant: string): string {
  return clock.format(new Date(instant));
}
