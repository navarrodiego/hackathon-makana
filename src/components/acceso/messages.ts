export type OperatorRole = "outgoing" | "control";

export interface OriginDetail { readonly expected: string | null; readonly received: string | null }

const PATH: Record<OperatorRole, string> = { outgoing: "/rodrigo", control: "/control" };

/** Códigos que significan «no hay sesión válida»: se resuelven ingresando de nuevo, sin recargar. */
export const isSessionProblem = (code: string) => code === "AUTH_REQUIRED" || code === "AUTH_INVALID" || code === "AUTH_EXPIRED";

/** Códigos que la página acepta en `?acceso=`; cualquier otro valor se ignora. */
export const LOGIN_ERROR_CODES = ["AUTH_INVALID", "AUTH_NOT_CONFIGURED", "ORIGIN_REJECTED"] as const;
export const loginErrorCode = (value: unknown) =>
  typeof value === "string" && (LOGIN_ERROR_CODES as readonly string[]).includes(value) ? value : null;

/** Qué falló al ingresar y cómo seguir. Distingue contraseña, configuración del servidor y dirección. */
export function loginErrorMessage(code: string, role: OperatorRole, origin?: OriginDetail): string {
  switch (code) {
    case "AUTH_INVALID":
      return "La contraseña no coincide. Revísala y vuelve a intentarlo.";
    case "AUTH_NOT_CONFIGURED":
      return "El servidor no tiene configurada la contraseña de operador (OPERATOR_SECRET). Nadie puede ingresar hasta configurarla.";
    case "ORIGIN_REJECTED":
      if (!origin?.expected) return "El servidor no tiene configurada su dirección oficial (APP_ORIGIN). Nadie puede ingresar hasta configurarla.";
      if (!origin.received) return `El servidor rechazó esta dirección. La dirección configurada es ${origin.expected}. Abre ${origin.expected}${PATH[role]} o corrige APP_ORIGIN.`;
      return `Abriste Relevo desde ${origin.received}, pero la dirección configurada es ${origin.expected}. Abre ${origin.expected}${PATH[role]} o corrige APP_ORIGIN.`;
    case "NETWORK":
      return "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.";
    default:
      return "No se pudo ingresar. Vuelve a intentarlo en unos segundos.";
  }
}
