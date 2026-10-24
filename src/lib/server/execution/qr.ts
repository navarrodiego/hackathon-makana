import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import { LIMITS, type Instant } from "@/lib/contracts/core";
import type { Execution } from "@/lib/contracts/domain";
import type { ChangeQr, ErrorCode, ServiceResult } from "@/lib/contracts/http";
import type { UnitOfWork } from "@/lib/contracts/repositories";
import type { PublicStateDTO } from "@/lib/contracts/public";
import { recordEvent } from "@/lib/server/events";
import { buildPublicState } from "@/lib/server/state";
import { complete, fingerprint, reserve } from "./idempotency";

const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const plus = (at: Instant | number, ms: number) => new Date((typeof at === "number" ? at : Date.parse(at)) + ms).toISOString() as Instant;

/**
 * Nuevos fines de espera y QR, o el error. `extend` suma 30 s al QR visible y a la espera si sigue corriendo;
 * `show` vuelve a mostrar el QR 30 s sin tocar la espera: quien ya escribe sigue pudiendo enviar.
 */
function nextWindow(execution: Execution, action: ChangeQr["action"], now: Instant): ServiceResult<Pick<Execution, "lobbyEndsAt" | "qrEndsAt">> {
  const at = Date.parse(now);
  const qrVisible = execution.qrEndsAt !== null && Date.parse(execution.qrEndsAt) > at;
  if (action === "show") {
    if (qrVisible) return fail("STATE_CONFLICT");
    return { ok: true, value: { lobbyEndsAt: execution.lobbyEndsAt, qrEndsAt: plus(at, LIMITS.qrExtensionMs) } };
  }
  if (!qrVisible) return fail("STATE_CONFLICT");
  const qrEndsAt = plus(execution.qrEndsAt!, LIMITS.qrExtensionMs);
  // Tope para que pulsar varias veces no deje el QR tapando el panel indefinidamente.
  if (Date.parse(qrEndsAt) > at + LIMITS.qrMaxAheadMs) return fail("STATE_CONFLICT");
  const lobbyRunning = execution.lobbyEndsAt !== null && Date.parse(execution.lobbyEndsAt) > at;
  return { ok: true, value: { lobbyEndsAt: lobbyRunning ? plus(execution.lobbyEndsAt!, LIMITS.qrExtensionMs) : execution.lobbyEndsAt, qrEndsAt } };
}

/** Amplía o vuelve a mostrar el QR del canal. Solo control, con canal abierto; registra el cambio con origen escenario. */
export async function changeQr(store: UnitOfWork, context: CommandContext, input: ChangeQr): Promise<ServiceResult<PublicStateDTO>> {
  if (context.principal.kind !== "control") return fail("FORBIDDEN");
  if (context.executionId !== input.executionId) return fail("EXECUTION_STALE");
  return store.run(context, async tx => {
    const reserved = await reserve<PublicStateDTO>(tx, context, { operation: "POST /api/qr", key: input.idempotencyKey, fingerprint: fingerprint("POST /api/qr", null, { ...input }) });
    if (!reserved.ok) return reserved;
    if ("replay" in reserved.value) return { ok: true, value: reserved.value.replay };
    const execution = await tx.aggregates.executions.get(context.executionId);
    if (!execution) return fail("NOT_FOUND");
    if (execution.version !== input.expectedVersion) return fail("VERSION_CONFLICT");
    if (!execution.channelOpen) return fail("CHANNEL_CLOSED");
    const window = nextWindow(execution, input.action, context.operationalNow);
    if (!window.ok) return window;
    const next = { ...execution, ...window.value, version: execution.version + 1 };
    if (!(await tx.aggregates.executions.compareAndSwap(next, { executionId: execution.executionId, version: execution.version }))) return fail("VERSION_CONFLICT");
    await recordEvent(tx, context, {
      kind: input.action === "show" ? "qr_shown" : "qr_extended", entity: { kind: "execution", id: execution.executionId },
      entityVersion: next.version, channel: "web", details: { kind: "record" }, result: "recorded",
    });
    const state = await buildPublicState(tx, next, context.operationalNow);
    await complete(tx, context, reserved.value.scope, 200, state);
    return { ok: true, value: state };
  });
}
