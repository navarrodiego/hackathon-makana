export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string; readonly network: boolean };

interface Envelope<T> { ok: boolean; data?: T; error?: { code?: string } }

/** POST de navegador: JSON, mismo origen y la cookie de sesión de control. */
export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
    });
    const parsed = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (parsed?.ok && parsed.data !== undefined) return { ok: true, data: parsed.data };
    return { ok: false, code: parsed?.error?.code ?? "UNKNOWN", network: false };
  } catch {
    return { ok: false, code: "NETWORK", network: true };
  }
}

const MESSAGES: Readonly<Record<string, string>> = {
  CHANNEL_CLOSED: "El canal está cerrado. Ábrelo antes de enviar un reporte guionado.",
  QUOTA_EXCEEDED: "Se alcanzó el límite de reportes. No se envió nada.",
  EXECUTION_STALE: "La demostración cambió de ejecución. Se actualizó la vista; vuelve a intentarlo.",
  VERSION_CONFLICT: "El estado cambió mientras actuabas. Se actualizó la vista; revisa y vuelve a intentarlo.",
  STATE_CONFLICT: "Esa acción ya no corresponde al estado actual. Se actualizó la vista.",
  CANDIDATE_STALE: "El incidente ya pasó a otra persona. Se actualizó la vista.",
  ACTION_EXPIRED: "El plazo de esta acción ya venció. Se actualizó la vista.",
  OPERATION_PENDING: "La operación anterior sigue en curso. Espera unos segundos y revisa el registro.",
  AUTH_REQUIRED: "Tu sesión de control terminó. Ingresa de nuevo con la contraseña de operador; no se registró nada.",
  AUTH_INVALID: "Tu sesión de control ya no es válida. Ingresa de nuevo con la contraseña de operador; no se registró nada.",
  AUTH_EXPIRED: "Tu sesión de control venció. Ingresa de nuevo con la contraseña de operador; no se registró nada.",
  AUTH_NOT_CONFIGURED: "El servidor no tiene configurada la contraseña de operador (OPERATOR_SECRET). No se registró nada.",
  FORBIDDEN: "Control no puede hacer esa acción.",
  ORIGIN_REJECTED: "El servidor rechazó la dirección desde la que abriste control. Abre la dirección oficial o revisa APP_ORIGIN.",
  NETWORK: "No se pudo comprobar si la acción quedó registrada. Revisa el registro antes de repetirla; un reintento no duplica la operación.",
  STORAGE_UNAVAILABLE: "El almacenamiento no respondió. No hay confirmación de que se haya guardado; revisa el registro.",
};
export const failureMessage = (code: string) => MESSAGES[code] ?? "La acción no se completó. Revisa el registro antes de repetirla.";
