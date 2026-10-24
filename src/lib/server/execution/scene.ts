import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ChangeScene, ErrorCode, ServiceResult } from "@/lib/contracts/http";
import type { UnitOfWork } from "@/lib/contracts/repositories";
import type { PublicStateDTO } from "@/lib/contracts/public";
import { recordEvent } from "@/lib/server/events";
import { buildPublicState } from "@/lib/server/state";
import { complete, fingerprint, reserve } from "./idempotency";

const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });

/**
 * Cambia la escena y la hora narrativa. No toca plazos de relevo ni de incidente: esos corren en tiempo real
 * y se evalúan en `evaluate`. No fabrica resultados; solo registra que el control cambió la escena (C09).
 */
export async function changeScene(store: UnitOfWork, context: CommandContext, input: ChangeScene): Promise<ServiceResult<PublicStateDTO>> {
  if (context.principal.kind !== "control") return fail("FORBIDDEN");
  if (context.executionId !== input.executionId) return fail("EXECUTION_STALE");
  return store.run(context, async tx => {
    const reserved = await reserve<PublicStateDTO>(tx, context, { operation: "POST /api/scene", key: input.idempotencyKey, fingerprint: fingerprint("POST /api/scene", null, { ...input }) });
    if (!reserved.ok) return reserved;
    if ("replay" in reserved.value) return { ok: true, value: reserved.value.replay };
    const execution = await tx.aggregates.executions.get(context.executionId);
    if (!execution) return fail("NOT_FOUND");
    if (execution.version !== input.expectedVersion) return fail("VERSION_CONFLICT");
    const scene = (await tx.reference.scenes()).find(s => s.id === input.sceneId);
    if (!scene) return fail("NOT_FOUND");
    const next = {
      ...execution, sceneId: scene.id, channelOpen: input.channelOpen, version: execution.version + 1,
      // Solo pasar de cerrado a abierto fija la hora: es el ancla común de la espera del canal y del QR grande.
      channelOpenedAt: !input.channelOpen ? null : execution.channelOpen ? execution.channelOpenedAt : context.operationalNow,
      // La nueva hora narrativa parte de la escena; el reloj operacional sigue siendo el real (C02).
      anchor: { operationalAt: context.operationalNow, narrativeAt: scene.narrativeAt },
    };
    if (!(await tx.aggregates.executions.compareAndSwap(next, { executionId: execution.executionId, version: execution.version }))) return fail("VERSION_CONFLICT");
    await recordEvent(tx, context, {
      kind: "scene_changed", entity: { kind: "execution", id: execution.executionId }, entityVersion: next.version, channel: "web",
      details: { kind: "transition", from: execution.sceneId, to: scene.id }, result: "recorded",
    });
    const state = await buildPublicState(tx, next, context.operationalNow);
    await complete(tx, context, reserved.value.scope, 200, state);
    return { ok: true, value: state };
  });
}
