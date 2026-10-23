import "server-only";
import { headers } from "next/headers";
import type { Instant } from "@/lib/contracts/core";
import type { ErrorCode } from "@/lib/contracts/http";
import type { ControlViewDTO } from "@/lib/contracts/private";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { getDb } from "@/lib/server/db";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createReadService } from "@/lib/server/state";

export type ControlLoad =
  | { readonly kind: "ready"; readonly view: ControlViewDTO }
  | { readonly kind: "denied"; readonly code: ErrorCode }
  | { readonly kind: "unavailable"; readonly code: ErrorCode };

const now = () => new Date().toISOString() as Instant;

/**
 * Lectura privada de `/control` (C08/C12): autoriza con la credencial Basic de control y consulta el servicio de lectura.
 * Sin caché; cada petición reconstruye el DTO. No evalúa plazos: eso lo hace `GET /api/state`.
 */
export async function loadControl(): Promise<ControlLoad> {
  try {
    const store = new PostgresPersistence(getDb());
    const execution = await store.current();
    if (!execution) return { kind: "unavailable", code: "STORAGE_UNAVAILABLE" };
    const h = await headers();
    const authorized = await createPersistedAuthorization(store).authorize({
      route: "read_control", executionId: execution.executionId,
      authorizationHeader: h.get("authorization"), originHeader: null, sessionCookie: null,
    });
    if (!authorized.ok) return { kind: "denied", code: authorized.code };
    const view = await createReadService({ store, now }).control(authorized.value);
    return view.ok ? { kind: "ready", view: view.value } : { kind: "denied", code: view.code };
  } catch {
    return { kind: "unavailable", code: "STORAGE_UNAVAILABLE" };
  }
}
