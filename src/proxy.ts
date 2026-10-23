import { NextResponse, type NextRequest } from "next/server";
import { SECURITY } from "@/lib/contracts/auth";
import { LIMITS, type Instant } from "@/lib/contracts/core";
import { loadAuthConfig } from "@/lib/server/auth/config";
import { basicPageAccess } from "@/lib/server/auth/service";
import { runtime } from "@/lib/server/messages/runtime";

const isPrefetch = (request: NextRequest) =>
  request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";

/**
 * C12: Rodrigo y control entran con HTTP Basic. Sin credencial válida para el rol de la página, el navegador
 * necesita un 401 con desafío para volver a pedirla; si no, reenvía la que tiene guardada (incluida la de otro rol)
 * y la página solo muestra el acceso denegado. La autorización completa sigue ocurriendo al cargar la página (T05).
 */
function basicAccess(request: NextRequest, route: "read_outgoing" | "read_control", message: string, realm: string) {
  if (basicPageAccess(route, request.headers.get("authorization"), loadAuthConfig()) === "pass") return NextResponse.next();
  return new NextResponse(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}", charset="UTF-8"`,
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

/**
 * Entrada del canal (C12): un GET a /canal reutiliza la sesión pública o emite `relevo_session`.
 * Nunca envía un reporte. La cookie nueva también se pasa a la página de esta misma petición.
 */
async function channelEntry(request: NextRequest) {
  if (request.method !== "GET" || isPrefetch(request)) return NextResponse.next();
  const existing = request.cookies.get(SECURITY.sessionCookieName)?.value ?? null;
  let entered;
  try {
    entered = await runtime().sessions.enter(existing, new Date().toISOString() as Instant);
  } catch { return NextResponse.next(); }
  if (!entered.ok || !entered.value.newOpaqueCookie) return NextResponse.next();
  const token = entered.value.newOpaqueCookie;
  const headers = new Headers(request.headers);
  const others = request.cookies.getAll().filter(c => c.name !== SECURITY.sessionCookieName).map(c => `${c.name}=${c.value}`);
  headers.set("cookie", [...others, `${SECURITY.sessionCookieName}=${token}`].join("; "));
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(SECURITY.sessionCookieName, token, {
    httpOnly: true, sameSite: SECURITY.sameSite, path: "/", maxAge: LIMITS.sessionMaxAgeMs / 1000,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

/** Un solo proxy por proyecto: reparte por ruta. */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/rodrigo") return basicAccess(request, "read_outgoing", "Ingresa con la credencial de Rodrigo para abrir el cierre de turno.", "Relevo · cierre de Rodrigo");
  // Control usa su propia credencial (C12), distinta de la de Rodrigo.
  if (path === "/control") return basicAccess(request, "read_control", "Ingresa con la credencial de control para operar la demostración.", "Relevo · control");
  return channelEntry(request);
}

export const config = { matcher: ["/rodrigo", "/canal", "/control"] };
