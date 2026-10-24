import { SECURITY } from "@/lib/contracts/auth";
import type { ApiFailure, ApiSuccess } from "@/lib/contracts/http";

/** Respuestas de API: sin caché y sin referrer, porque pueden llegar desde páginas con enlaces privados. */
export function jsonResponse(result: ApiSuccess<unknown> | ApiFailure, headers: HeadersInit = {}): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": SECURITY.cacheControl, "referrer-policy": SECURITY.referrerPolicy, "x-content-type-options": "nosniff", ...headers },
  });
}

/**
 * Comprime con gzip si el cliente lo acepta. `next start` no comprime las rutas de API y el estado público crece con
 * cada reporte (cientos de KB): en un wifi saturado eso se nota en cada sondeo. Si la plataforma ya comprime, una
 * respuesta con `content-encoding` pasa tal cual.
 */
export function gzipped(response: Response, request: Request | undefined): Response {
  const accepts = request?.headers.get("accept-encoding") ?? "";
  if (!response.body || !/\bgzip\b/i.test(accepts)) return response;
  const headers = new Headers(response.headers);
  headers.set("content-encoding", "gzip");
  headers.append("vary", "accept-encoding");
  headers.delete("content-length");
  return new Response(response.body.pipeThrough(new CompressionStream("gzip")), { status: response.status, headers });
}
