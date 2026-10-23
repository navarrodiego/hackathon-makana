import { SECURITY } from "@/lib/contracts/auth";

export interface RequestAuthHeaders {
  readonly authorizationHeader: string | null;
  readonly originHeader: string | null;
  readonly sessionCookie: string | null;
  readonly operatorCookies: { readonly outgoing: string | null; readonly control: string | null };
}

/** Valor de una cookie por nombre. Dos cookies con el mismo nombre son ambiguas: se tratan como ausentes. */
export function cookieValue(cookieHeader: string | null, name: string): string | null {
  const matches = (cookieHeader ?? "").split(";").map(c => c.trim()).filter(c => c.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}

/** Cookies de sesión de operador; también las usan las páginas privadas, que leen la cabecera con `headers()`. */
export function operatorCookies(cookieHeader: string | null): RequestAuthHeaders["operatorCookies"] {
  return {
    outgoing: cookieValue(cookieHeader, SECURITY.operatorCookieNames.outgoing),
    control: cookieValue(cookieHeader, SECURITY.operatorCookieNames.control),
  };
}

/** Solo extrae lo que AuthorizationInput necesita; el resto de la cookie nunca sale de aquí. */
export function authHeaders(request: Request): RequestAuthHeaders {
  const cookie = request.headers.get("cookie");
  return {
    authorizationHeader: request.headers.get("authorization"),
    originHeader: request.headers.get("origin"),
    sessionCookie: cookieValue(cookie, SECURITY.sessionCookieName),
    operatorCookies: operatorCookies(cookie),
  };
}
