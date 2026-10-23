import { SECURITY } from "@/lib/contracts/auth";
import type { ApiFailure, ApiSuccess } from "@/lib/contracts/http";

/** Respuestas de API: sin caché y sin referrer, porque pueden llegar desde páginas con enlaces privados. */
export function jsonResponse(result: ApiSuccess<unknown> | ApiFailure, headers: HeadersInit = {}): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": SECURITY.cacheControl, "referrer-policy": SECURITY.referrerPolicy, "x-content-type-options": "nosniff", ...headers },
  });
}
