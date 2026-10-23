import type { PublicStateDTO } from "@/lib/contracts/client";

/** GET /api/state sin caché. Devuelve `null` ante cualquier fallo; el llamador decide qué mostrar. */
export async function getPublicState(signal: AbortSignal): Promise<PublicStateDTO | null> {
  try {
    const response = await fetch("/api/state", { cache: "no-store", signal });
    const body = (await response.json()) as { ok?: boolean; data?: PublicStateDTO };
    return body.ok && body.data ? body.data : null;
  } catch {
    return null;
  }
}
