import "server-only";
import { createHash } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ApiSuccess, ServiceResult } from "@/lib/contracts/http";
import type { IdempotencyScope, SavedResponse, TransactionRepositories } from "@/lib/contracts/repositories";

type Operation = IdempotencyScope["operation"];

/** JSON canónico: claves ordenadas recursivamente; los arreglos conservan su orden (C14). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** La clave de idempotencia y las credenciales no entran en la huella; sí método, ruta, parámetros y cuerpo. */
export function fingerprint(operation: Operation, params: unknown, body: Record<string, unknown>): string {
  const { idempotencyKey: _key, ...rest } = body; void _key;
  return createHash("sha256").update(canonicalJson({ method: "POST", operation, params: params ?? null, body: rest })).digest("hex");
}

/** Identidad interna del principal; nunca apodo, token crudo ni actor representado por control. */
export function principalKey(context: CommandContext): string {
  const p = context.principal;
  switch (p.kind) {
    case "outgoing": case "recipient": return `actor:${p.actorId}`;
    case "control": return `control:${p.operatorId}`;
    case "reporter": return `session:${p.sessionId}`;
    case "system": return "system";
  }
}

/**
 * Reserva, ejecuta y completa dentro de la misma transacción. Un `ok:false` revierte también la reserva,
 * así que ningún fallo queda guardado como éxito repetible. Un replay coincidente devuelve la respuesta original.
 */
export async function idempotent<O extends Extract<Operation, "POST /api/handoff" | "POST /api/handoff/[id]/accept" | "POST /api/handoff/[id]/reject">, T>(
  transaction: TransactionRepositories, context: CommandContext,
  spec: { readonly operation: O; readonly key: string; readonly fingerprint: string; readonly status: 200 | 201 },
  run: () => Promise<ServiceResult<T>>,
): Promise<ServiceResult<T>> {
  const scope: IdempotencyScope = { executionId: context.executionId, principalKey: principalKey(context), operation: spec.operation, key: spec.key };
  const reserved = await transaction.idempotency.reserve({ ...scope, fingerprint: spec.fingerprint, createdAt: context.operationalNow, status: "pending", response: null, successorExecutionId: null });
  if (!reserved.inserted) {
    if (reserved.record.fingerprint !== spec.fingerprint) return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
    if (reserved.record.status === "pending" || !reserved.record.response) return { ok: false, code: "OPERATION_PENDING" };
    return { ok: true, value: (reserved.record.response.response as ApiSuccess<T, 200 | 201>).body.data };
  }
  const result = await run();
  if (!result.ok) return result;
  await transaction.idempotency.complete(scope, { route: spec.operation, response: { status: spec.status, body: { ok: true, data: result.value, correlationId: context.correlationId } } } as unknown as SavedResponse);
  return result;
}
