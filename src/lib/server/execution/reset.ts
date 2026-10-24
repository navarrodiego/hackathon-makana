import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ActorId, ExecutionId, HandoffId, Instant, TicketId } from "@/lib/contracts/core";
import type { Coverage, CoverageWindow, Execution, Handoff, Ticket } from "@/lib/contracts/domain";
import { BASE_FIXTURE } from "@/lib/contracts/fixtures";
import type { ErrorCode, ResetExecution, ResetResultDTO, ServiceResult } from "@/lib/contracts/http";
import type { TransactionRepositories, UnitOfWork } from "@/lib/contracts/repositories";
import type { HandoffNoteService } from "@/lib/contracts/services";
import { principalKey } from "@/lib/server/handoff/idempotency";
import { recordEvent } from "@/lib/server/events";
import { buildPublicState } from "@/lib/server/state";
import { complete, fingerprint, reserve } from "./idempotency";

const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const OPERATION = "POST /api/reset" as const;

/**
 * Siembra la ejecución sucesora con los datos ficticios del escenario base (C02/C03). Actores y escenas ya viajan con
 * `replaceExecution`; aquí se reutilizan sus identidades y se crean ventana, pendientes, relevo en borrador y cobertura
 * sin confirmar. Sin IA, sin avisos y sin candidatos: la nota se prepara después, fuera de la transacción.
 */
async function seedSuccessor(tx: TransactionRepositories, execution: Execution): Promise<ServiceResult<null>> {
  const [actors, scenes] = await Promise.all([tx.reference.actors(), tx.reference.scenes()]);
  const fixture = BASE_FIXTURE;
  const actor = new Map<string, ActorId>();
  for (const a of fixture.actors) {
    const found = actors.find(x => x.displayName === a.displayName);
    if (!found) return fail("STATE_CONFLICT");
    actor.set(a.id, found.id);
  }
  const mapped = (id: string) => actor.get(id)!;
  if (!scenes.length) return fail("STATE_CONFLICT");
  // Las escenas se copian de la anterior: una que salió del escenario se retira aquí, o seguiría en cada reset.
  const labels = new Set<string>(fixture.scenes.map(s => s.label));
  await tx.reference.removeScenes(scenes.filter(s => !labels.has(s.label)).map(s => s.id));
  const executionId = execution.executionId;
  const windowId = `window_${randomUUID()}` as const;
  const window: CoverageWindow = {
    id: windowId, executionId, startsAt: fixture.window.startsAt, endsAt: fixture.window.endsAt, outgoingEndsAt: fixture.window.outgoingEndsAt,
    outgoingActorId: mapped(fixture.window.outgoingActorId), incomingActorId: mapped(fixture.window.incomingActorId),
    backupActorIds: fixture.window.backupActorIds.map(mapped), coordinatorActorId: mapped(fixture.window.coordinatorActorId),
  };
  await tx.reference.insertWindow(window);
  const ticketIds: TicketId[] = [];
  for (const t of fixture.tickets) {
    const ticket: Ticket = {
      executionId, version: 1, id: `ticket_${randomUUID()}` as TicketId, reference: t.reference, text: t.text,
      suggestedDisposition: null, disposition: t.disposition, reason: t.reason, incidentId: null,
    };
    await tx.aggregates.tickets.insert(ticket);
    ticketIds.push(ticket.id);
  }
  const handoff: Handoff = {
    id: `handoff_${randomUUID()}` as HandoffId, executionId, version: 1, windowId, outgoingActorId: window.outgoingActorId,
    status: "draft", currentAttemptId: null, ticketIds, note: "", savedSuggestion: null, sentAt: null, acceptedAt: null,
    acceptedBy: null, effectiveAt: window.startsAt,
  };
  await tx.aggregates.handoffs.insert(handoff);
  const coverage: Coverage = { id: `coverage_${randomUUID()}`, executionId, version: 1, windowId, status: "unconfirmed", actorId: null, acceptedAt: null };
  await tx.aggregates.coverages.insert(coverage);
  return { ok: true, value: null };
}

export interface ResetDeps {
  readonly store: UnitOfWork;
}

/**
 * Crea una ejecución nueva (C09). Todo ocurre en una transacción: la anterior queda retirada, la nueva nace con canal
 * cerrado, pendientes del escenario y `preparation=pending`. Tokens, claves y trabajo de IA de la anterior fallan por
 * ejecución desconocida. No destruye el esquema ni borra la historia anterior.
 */
export async function resetExecution(deps: ResetDeps, context: CommandContext, input: ResetExecution): Promise<ServiceResult<ResetResultDTO>> {
  if (context.principal.kind !== "control") return fail("FORBIDDEN");
  if (context.executionId !== input.executionId) return fail("EXECUTION_STALE");
  const print = fingerprint(OPERATION, null, { ...input });
  // Reintento tras un reset exitoso: la ejecución del llamador ya no es la vigente, pero la clave sí fue completada.
  const scope = { executionId: context.executionId, principalKey: principalKey(context), operation: OPERATION, key: input.idempotencyKey } as const;
  const replayed = async (): Promise<ServiceResult<ResetResultDTO> | null> => {
    const replay = await deps.store.replayReset(scope, print);
    if (!replay.ok) return replay;
    return replay.value ? { ok: true, value: (replay.value.response as { body: { data: ResetResultDTO } }).body.data } : null;
  };
  const early = await replayed();
  if (early) return early;
  const created = await runReset(deps, context, input, print);
  // Un reintento simultáneo pudo ganar entre la comprobación y el bloqueo: su resultado es el de esta clave.
  if (!created.ok && created.code === "EXECUTION_STALE") return (await replayed()) ?? created;
  return created;
}

async function runReset(deps: ResetDeps, context: CommandContext, input: ResetExecution, print: string): Promise<ServiceResult<ResetResultDTO>> {
  return deps.store.run(context, async tx => {
    const reserved = await reserve<ResetResultDTO>(tx, context, { operation: OPERATION, key: input.idempotencyKey, fingerprint: print });
    if (!reserved.ok) return reserved;
    if ("replay" in reserved.value) return { ok: true, value: reserved.value.replay };
    const current = await tx.aggregates.executions.get(context.executionId);
    if (!current) return fail("NOT_FOUND");
    if (current.version !== input.expectedVersion) return fail("VERSION_CONFLICT");
    const first = (await tx.reference.scenes())[0];
    if (!first) return fail("STATE_CONFLICT");
    const now: Instant = context.operationalNow;
    const next: Execution = {
      executionId: `execution_${randomUUID()}` as ExecutionId, version: 1, status: "active", sceneId: first.id,
      anchor: { operationalAt: now, narrativeAt: first.narrativeAt }, channelOpen: false, channelOpenedAt: null, admittedReports: 0,
      preparation: "pending", createdAt: now, supersededBy: null,
    };
    const successor = await tx.replaceExecution(next, input.expectedVersion);
    if (!successor) return fail("VERSION_CONFLICT");
    const seeded = await seedSuccessor(successor, next);
    if (!seeded.ok) return seeded;
    const nextContext: CommandContext = {
      ...context, executionId: next.executionId, executionVersion: next.version, actorId: null, narrativeNow: first.narrativeAt,
    };
    await recordEvent(successor, nextContext, {
      kind: "execution_started", entity: { kind: "execution", id: next.executionId }, entityVersion: next.version, channel: "web",
      details: { kind: "transition", from: current.executionId, to: next.executionId }, result: "recorded",
    });
    const result: ResetResultDTO = {
      previousExecutionId: current.executionId, executionId: next.executionId, preparation: "pending",
      state: await buildPublicState(successor, next, now),
    };
    await complete(tx, context, reserved.value.scope, 201, result, next.executionId);
    return { ok: true, value: result };
  });
}

/**
 * Marca la preparación de la ejecución indicada (C03/C09). Sin servicio de nota, como en la demo, el resumen de
 * traspaso es fijo en el código y la preparación queda lista sin llamar a ningún proveedor. Con servicio, genera y
 * guarda la nota fuera de la transacción del reset; si entretanto hubo otro reset, la escritura falla por ejecución
 * retirada y no repuebla la nueva (S04). Un fallo deja `failed` sin nota inventada.
 */
const preparing = new Set<ExecutionId>();

export async function prepareNote(
  deps: ResetDeps & { readonly note?: HandoffNoteService }, context: CommandContext, signal?: AbortSignal,
): Promise<ServiceResult<"ready" | "failed">> {
  // Un reintento de reset reprograma esta tarea: si ya hay una generación en curso en este proceso, no se paga otra.
  if (preparing.has(context.executionId)) return fail("OPERATION_PENDING");
  preparing.add(context.executionId);
  try { return await prepare(deps, context, signal); } finally { preparing.delete(context.executionId); }
}

async function prepare(
  deps: ResetDeps & { readonly note?: HandoffNoteService }, context: CommandContext, signal?: AbortSignal,
): Promise<ServiceResult<"ready" | "failed">> {
  let status: "ready" | "failed" = "ready";
  if (deps.note) {
    const current = await deps.store.run(context, async tx => ({ ok: true, value: (await tx.aggregates.executions.get(context.executionId))?.preparation ?? null }));
    if (current.ok && current.value && current.value !== "pending") return { ok: true, value: current.value };
    const generated = await deps.note.prepare(context, signal);
    if (!generated.ok && generated.code === "EXECUTION_STALE") return generated;
    status = generated.ok ? "ready" : "failed";
  }
  return deps.store.run(context, async tx => {
    const execution = await tx.aggregates.executions.get(context.executionId);
    if (!execution) return fail("NOT_FOUND");
    if (execution.preparation !== "pending") return { ok: true, value: execution.preparation === "ready" ? "ready" as const : "failed" as const };
    const next: Execution = { ...execution, preparation: status, version: execution.version + 1 };
    if (!(await tx.aggregates.executions.compareAndSwap(next, { executionId: execution.executionId, version: execution.version }))) return fail("VERSION_CONFLICT");
    return { ok: true, value: status };
  });
}
