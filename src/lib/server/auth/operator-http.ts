import "server-only";
import { randomUUID } from "node:crypto";
import { SECURITY, type OperatorRole } from "@/lib/contracts/auth";
import type { CorrelationId } from "@/lib/contracts/core";
import { LIMITS } from "@/lib/contracts/core";
import type { ErrorCode } from "@/lib/contracts/http";
import { failure, success } from "@/lib/server/http/errors";
import { checkOrigin } from "@/lib/server/http/origin";
import { jsonResponse } from "@/lib/server/http/response";
import { secretsEqual } from "./credentials";
import { issueOperatorToken } from "./operator-session";
import type { AuthConfig } from "./service";

export interface OperatorHttpDeps {
  readonly config: AuthConfig;
  readonly nowMs: () => number;
  /** Pausa fija tras una contraseña incorrecta; frena intentos repetidos sin bloquear a quien se equivocó. */
  readonly failureDelay: () => Promise<void>;
}

const ROLES: readonly OperatorRole[] = ["outgoing", "control"];
const newCorrelation = () => `correlation_${randomUUID()}` as CorrelationId;
const fail = (code: ErrorCode) => jsonResponse(failure(code, newCorrelation()));

function cookie(request: Request, role: OperatorRole, value: string, maxAgeSeconds: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SECURITY.operatorCookieNames[role]}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

/** Página de cada rol; el formulario sin JavaScript vuelve aquí. Fija por rol: nunca se toma de la solicitud. */
const PAGE: Record<OperatorRole, string> = { outgoing: "/rodrigo", control: "/control" };
/** Parámetro con el que la página muestra el error de un ingreso sin JavaScript. Solo lleva el código. */
export const LOGIN_ERROR_PARAM = "acceso";

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return null;
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}

const isRole = (value: unknown): value is OperatorRole => ROLES.includes(value as OperatorRole);
const isForm = (request: Request) => (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded");

async function readForm(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const form = await request.formData();
    return { role: form.get("role"), secret: form.get("secret") };
  } catch { return null; }
}

/** Respuesta del formulario nativo: vuelve a la página del rol (303), con el código de error si falló. */
function backToPage(role: OperatorRole, code: ErrorCode | null, headers: Record<string, string> = {}): Response {
  const location = code ? `${PAGE[role]}?${LOGIN_ERROR_PARAM}=${code}` : PAGE[role];
  return new Response(null, { status: 303, headers: { location, "cache-control": SECURITY.cacheControl, "referrer-policy": SECURITY.referrerPolicy, ...headers } });
}

/**
 * `POST /api/acceso` (C12): una sola contraseña de operador; el rol lo fija la página donde se ingresa.
 * Orden: formato → origen → configuración → contraseña. Ante origen rechazado devuelve el APP_ORIGIN configurado
 * (es público: va en el QR) para que un error de configuración no parezca una contraseña mal escrita.
 * Acepta también el formulario nativo (sin JavaScript): POST urlencoded y respuesta 303 a la página del rol, para que
 * la contraseña nunca termine en una URL.
 */
export async function handleOperatorLogin(deps: OperatorHttpDeps, request: Request): Promise<Response> {
  const form = isForm(request);
  const body = form ? await readForm(request) : await readJson(request);
  if (!body || !isRole(body.role) || typeof body.secret !== "string" || body.secret.length > 512) return fail("INVALID_INPUT");
  const role = body.role;
  const origin = request.headers.get("origin");
  if (!checkOrigin({ origin, appOrigin: deps.config.appOrigin, allowMissing: false })) {
    if (form) return backToPage(role, "ORIGIN_REJECTED");
    const rejected = failure("ORIGIN_REJECTED", newCorrelation());
    return Response.json(
      { ...rejected.body, origin: { expected: deps.config.appOrigin ?? null, received: origin } },
      { status: rejected.status, headers: { "cache-control": SECURITY.cacheControl, "referrer-policy": SECURITY.referrerPolicy, "x-content-type-options": "nosniff" } },
    );
  }
  if (!deps.config.operatorSecret) return form ? backToPage(role, "AUTH_NOT_CONFIGURED") : fail("AUTH_NOT_CONFIGURED");
  if (!secretsEqual(body.secret.trim(), deps.config.operatorSecret)) {
    await deps.failureDelay();
    if (form) return backToPage(role, "AUTH_INVALID");
    return fail("AUTH_INVALID");
  }
  const setCookie = cookie(request, role, issueOperatorToken(role, deps.config.operatorSecret, deps.nowMs()), LIMITS.sessionMaxAgeMs / 1000);
  if (form) return backToPage(role, null, { "set-cookie": setCookie });
  return jsonResponse(success({ role }, 200, newCorrelation()), { "set-cookie": setCookie });
}

/**
 * `POST /api/acceso/salir`: borra las sesiones de operador de este navegador, de ambos roles. Si solo borrara la del
 * rol de la página, una sesión de control seguiría abriendo /rodrigo. No exige APP_ORIGIN, para que un origen mal
 * configurado no impida salir; el cuerpo JSON obliga a un preflight que otro sitio no supera.
 */
export async function handleOperatorLogout(request: Request): Promise<Response> {
  if (!(await readJson(request))) return fail("INVALID_INPUT");
  const response = jsonResponse(success({ signedOut: ROLES }, 200, newCorrelation()));
  for (const role of ROLES) response.headers.append("set-cookie", cookie(request, role, "", 0));
  return response;
}
