import "server-only";
import type { HandoffId } from "@/lib/contracts/core";
import type { ErrorCode, ServiceResult } from "@/lib/contracts/http";
import type { HandoffPackageDTO } from "@/lib/contracts/private";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { getDb } from "@/lib/server/db";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createReadService } from "@/lib/server/state";

let cached: { store: PostgresPersistence; authorization: ReturnType<typeof createPersistedAuthorization>; read: ReturnType<typeof createReadService> } | undefined;
/** Ensamblado perezoso: no abre el pool al importar (build sin DB). */
function deps() {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    const now = () => new Date().toISOString() as ReturnType<Parameters<typeof createReadService>[0]["now"]>;
    cached = { store, authorization: createPersistedAuthorization(store), read: createReadService({ store, now }) };
  }
  return cached;
}

/**
 * Lectura del paquete en cada carga (C08): autoriza con la concesión del enlace y no tiene efectos.
 * Abrir el enlace nunca acepta ni acusa. Toda denegación llega sin datos.
 */
export async function loadHandoffPackage(id: string, token: string | undefined): Promise<ServiceResult<HandoffPackageDTO>> {
  try {
    const { store, authorization, read } = deps();
    const execution = await store.current();
    if (!execution) return { ok: false, code: "STORAGE_UNAVAILABLE" };
    const authorized = await authorization.authorize({
      route: "read_handoff", executionId: execution.executionId, authorizationHeader: null, sessionCookie: null,
      originHeader: null, recipientLinkToken: token, entityId: id as HandoffId,
    });
    if (!authorized.ok) return authorized;
    return await read.recipient(authorized.value, id as HandoffId);
  } catch {
    return { ok: false, code: "STORAGE_UNAVAILABLE" as ErrorCode };
  }
}
