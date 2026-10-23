import { SECURITY } from "@/lib/contracts/auth";

export interface RequestAuthHeaders {
  readonly authorizationHeader: string | null;
  readonly originHeader: string | null;
  readonly sessionCookie: string | null;
}

/** Solo extrae lo que AuthorizationInput necesita; el resto de la cookie nunca sale de aquí. */
export function authHeaders(request: Request): RequestAuthHeaders {
  const matches = (request.headers.get("cookie") ?? "").split(";").map(c => c.trim()).filter(c => c.startsWith(`${SECURITY.sessionCookieName}=`));
  return {
    authorizationHeader: request.headers.get("authorization"),
    originHeader: request.headers.get("origin"),
    // Dos cookies con el mismo nombre son ambiguas: se tratan como ausentes.
    sessionCookie: matches.length === 1 ? matches[0].slice(SECURITY.sessionCookieName.length + 1) : null,
  };
}
