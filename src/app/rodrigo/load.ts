import "server-only";
import { headers } from "next/headers";
import type { Instant } from "@/lib/contracts/core";
import type { ErrorCode } from "@/lib/contracts/http";
import type { RodrigoViewDTO } from "@/lib/contracts/private";
import type { HandoffId } from "@/lib/contracts/core";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { getDb } from "@/lib/server/db";
import { operatorCookies } from "@/lib/server/http/request";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createReadService } from "@/lib/server/state";

export type RodrigoLoad =
  | { readonly kind: "ready"; readonly view: RodrigoViewDTO; readonly handoffId: HandoffId }
  | { readonly kind: "denied"; readonly code: ErrorCode }
  | { readonly kind: "unavailable"; readonly code: ErrorCode };

const now = () => new Date().toISOString() as Instant;

/**
 * Lectura privada de `/rodrigo` (C08/C12): la página autoriza con la sesión de operador (o Basic de respaldo) y consulta
 * el servicio de lectura. No hay caché; cada petición reconstruye el DTO. El id del relevo en borrador sale del
 * estado público saneado porque la vista de Rodrigo no lo trae mientras el relevo no se envía.
 */
export async function loadRodrigo(): Promise<RodrigoLoad> {
  try {
    const store = new PostgresPersistence(getDb());
    const execution = await store.current();
    if (!execution) return { kind: "unavailable", code: "STORAGE_UNAVAILABLE" };
    const h = await headers();
    const authorization = createPersistedAuthorization(store);
    const authorized = await authorization.authorize({
      route: "read_outgoing", executionId: execution.executionId,
      authorizationHeader: h.get("authorization"), originHeader: null, sessionCookie: null,
      operatorCookies: operatorCookies(h.get("cookie")),
    });
    if (!authorized.ok) return { kind: "denied", code: authorized.code };
    const read = createReadService({ store, now });
    const [view, pub] = await Promise.all([read.outgoing(authorized.value), read.publicState()]);
    if (!view.ok) return { kind: "denied", code: view.code };
    if (!pub.ok || !pub.value.handoff) return { kind: "unavailable", code: pub.ok ? "NOT_FOUND" : pub.code };
    return { kind: "ready", view: view.value, handoffId: pub.value.handoff.id };
  } catch {
    return { kind: "unavailable", code: "STORAGE_UNAVAILABLE" };
  }
}
