import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ExecutionId } from "@/lib/contracts/core";
import type { ApiSuccess, ServiceResult } from "@/lib/contracts/http";
import type { IdempotencyScope, SavedResponse, TransactionRepositories } from "@/lib/contracts/repositories";
import { principalKey } from "@/lib/server/handoff/idempotency";

export { fingerprint } from "@/lib/server/handoff/idempotency";

export type ExecutionOperation = Extract<IdempotencyScope["operation"], "POST /api/scene" | "POST /api/reset">;

/**
 * Reserva dentro de la transacción del llamador (misma regla que relevo e incidentes, C14). Un fallo posterior
 * revierte también la reserva; un replay idéntico devuelve el resultado original sin repetir la transición.
 */
export async function reserve<T>(
  tx: TransactionRepositories, context: CommandContext,
  spec: { readonly operation: ExecutionOperation; readonly key: string; readonly fingerprint: string },
): Promise<ServiceResult<{ readonly replay: T } | { readonly scope: IdempotencyScope }>> {
  const scope: IdempotencyScope = { executionId: context.executionId, principalKey: principalKey(context), operation: spec.operation, key: spec.key };
  const reserved = await tx.idempotency.reserve({ ...scope, fingerprint: spec.fingerprint, createdAt: context.operationalNow, status: "pending", response: null, successorExecutionId: null });
  if (reserved.inserted) return { ok: true, value: { scope } };
  if (reserved.record.fingerprint !== spec.fingerprint) return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
  if (reserved.record.status === "pending" || !reserved.record.response) return { ok: false, code: "OPERATION_PENDING" };
  return { ok: true, value: { replay: (reserved.record.response.response as ApiSuccess<T>).body.data } };
}

export function complete<T>(
  tx: TransactionRepositories, context: CommandContext, scope: IdempotencyScope, status: 200 | 201, data: T, successor?: ExecutionId,
): Promise<void> {
  return tx.idempotency.complete(scope, { route: scope.operation, response: { status, body: { ok: true, data, correlationId: context.correlationId } } } as unknown as SavedResponse, successor);
}
