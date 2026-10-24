import "server-only";
import type { Instant } from "@/lib/contracts/core";
import type { ServiceResult } from "@/lib/contracts/http";
import type { ExecutionReader, UnitOfWork } from "@/lib/contracts/repositories";
import type { ReadService } from "@/lib/contracts/services";
import type { PublicStateDTO } from "@/lib/contracts/public";
import { systemContext } from "./context";
import { controlView, outgoingView, ownReportsView, recipientView } from "./private";
import { buildPublicState } from "./public";

export { systemContext } from "./context";
export { buildPublicState } from "./public";

export interface ReadDeps {
  readonly store: UnitOfWork & ExecutionReader;
  readonly now: () => Instant;
}

/**
 * Lecturas sin efectos: no evalúan plazos ni escriben. Cada una reconstruye el DTO desde repositorios
 * dentro de una transacción corta; no hay caché que oculte cambios operativos (C08).
 */
export function createReadService(deps: ReadDeps): ReadService {
  async function publicState(attempt = 0): Promise<ServiceResult<PublicStateDTO>> {
    const execution = await deps.store.current();
    if (!execution) return { ok: false, code: "STORAGE_UNAVAILABLE" };
    const now = deps.now();
    const result = await deps.store.runReadFirst(systemContext(execution, now), async tx => {
      const fresh = await tx.aggregates.executions.get(execution.executionId);
      return fresh ? { ok: true, value: await buildPublicState(tx, fresh, now) } : { ok: false, code: "STORAGE_UNAVAILABLE" };
    });
    // Un reset entre la lectura de la ejecución y la transacción deja la anterior retirada: se relee una vez.
    if (!result.ok && result.code === "EXECUTION_STALE" && attempt === 0) return publicState(1);
    return result;
  }
  return {
    publicState: () => publicState(),
    outgoing: context => deps.store.runReadFirst(context, tx => outgoingView(tx, context)),
    recipient: (context, id) => deps.store.runReadFirst(context, tx => recipientView(tx, context, id)),
    control: context => deps.store.runReadFirst(context, tx => controlView(tx, context, context.operationalNow)),
    ownReports: context => deps.store.runReadFirst(context, tx => ownReportsView(tx, context)),
  };
}
