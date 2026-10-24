import type { PublicStateDTO } from "@/lib/contracts/client";
import { fetchWithTimeout } from "../fetch-timeout";

/** Una consulta sin respuesta en este plazo cuenta como pérdida de conexión, no como «En vivo». */
export const STATE_TIMEOUT_MS = 8000;

/** GET /api/state sin caché. Devuelve `null` ante cualquier fallo o demora; el llamador decide qué mostrar. */
export async function getPublicState(signal: AbortSignal): Promise<PublicStateDTO | null> {
  try {
    const response = await fetchWithTimeout("/api/state", { cache: "no-store", signal, timeoutMs: STATE_TIMEOUT_MS });
    const body = (await response.json()) as { ok?: boolean; data?: PublicStateDTO };
    return body.ok && body.data ? body.data : null;
  } catch {
    return null;
  }
}
