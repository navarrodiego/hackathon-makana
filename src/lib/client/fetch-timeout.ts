/**
 * `fetch` con plazo: una red colgada (wifi que no responde) termina en error en vez de dejar la petición abierta
 * por minutos. Respeta además la señal del llamador. El error es el mismo de una red caída: el llamador ya lo trata.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL, init: RequestInit & { readonly timeoutMs: number }, send: typeof fetch = fetch,
): Promise<Response> {
  const { timeoutMs, signal: external, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Sin respuesta a tiempo", "TimeoutError")), timeoutMs);
  const onAbort = () => controller.abort(external?.reason);
  if (external?.aborted) onAbort(); else external?.addEventListener("abort", onAbort, { once: true });
  // El plazo sigue corriendo tras los encabezados: también cubre leer el cuerpo. Abortar una respuesta ya leída no
  // tiene efecto; solo se limpia antes si la petición falló.
  return send(input, { ...rest, signal: controller.signal }).catch(error => {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
    throw error;
  });
}
