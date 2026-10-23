import { NextResponse, type NextRequest } from "next/server";
import { SECURITY } from "@/lib/contracts/auth";
import { LIMITS, type Instant } from "@/lib/contracts/core";
import { runtime } from "@/lib/server/messages/runtime";

const isPrefetch = (request: NextRequest) =>
  request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";

/**
 * Entrada del canal (C12): un GET a /canal reutiliza la sesión pública o emite `relevo_session`.
 * Nunca envía un reporte. La cookie nueva también se pasa a la página de esta misma petición.
 */
export async function proxy(request: NextRequest) {
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

export const config = { matcher: "/canal" };
