import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ApiSuccess, ServiceResult } from "@/lib/contracts/http";
import type { IdempotencyScope, SavedResponse, TransactionRepositories } from "@/lib/contracts/repositories";
import { principalKey } from "@/lib/server/handoff/idempotency";

export { fingerprint } from "@/lib/server/handoff/idempotency";

/**
 * Misma regla que el relevo (C14): reserva, trabajo y respuesta comparten la TX; un fallo revierte la reserva
 * y un replay coincidente devuelve el resultado original sin nueva transición ni aviso.
 */
export async function idempotentAck<T>(
  transaction: TransactionRepositories, context: CommandContext,
  spec: { readonly key: string; readonly fingerprint: string },
  run: () => Promise<ServiceResult<T>>,
): Promise<ServiceResult<T>> {
  const operation = "POST /api/ack/[id]" as const;
  const scope: IdempotencyScope = { executionId: context.executionId, principalKey: principalKey(context), operation, key: spec.key };
  const reserved = await transaction.idempotency.reserve({ ...scope, fingerprint: spec.fingerprint, createdAt: context.operationalNow, status: "pending", response: null, successorExecutionId: null });
  if (!reserved.inserted) {
    if (reserved.record.fingerprint !== spec.fingerprint) return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
    if (reserved.record.status === "pending" || !reserved.record.response) return { ok: false, code: "OPERATION_PENDING" };
    return { ok: true, value: (reserved.record.response.response as ApiSuccess<T, 200>).body.data };
  }
  const result = await run();
  if (!result.ok) return result;
  await transaction.idempotency.complete(scope, { route: operation, response: { status: 200, body: { ok: true, data: result.value, correlationId: context.correlationId } } } as unknown as SavedResponse);
  return result;
}
