import "server-only";
import { createHash } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import type { NoteInput, StructuredProvider } from "@/lib/contracts/classification";
import type { AsyncFence, HandoffId, Version } from "@/lib/contracts/core";
import type { StoredNote } from "@/lib/contracts/domain";
import type { ErrorCode, ServiceResult, SuggestHandoff, SuggestionResultDTO } from "@/lib/contracts/http";
import type { IdempotencyScope, TransactionRepositories, UnitOfWork } from "@/lib/contracts/repositories";
import type { HandoffNoteService } from "@/lib/contracts/services";
import { failure, success } from "@/lib/server/http/errors";

const OPERATION = "POST /api/handoff/suggest" as const;
const POLICY_VERSION = "C05-v1" as const;

interface Snapshot { readonly handoffId: HandoffId; readonly version: Version; readonly input: NoteInput }
interface Target { readonly handoffId?: HandoffId; readonly expectedVersion?: Version }

type GenerateFailure = "PROVIDER_FAILED" | "PROVIDER_TIMEOUT" | "EXECUTION_STALE";
type GenerateResult = { readonly ok: true; readonly value: StoredNote } | { readonly ok: false; readonly code: GenerateFailure };

const failGenerate = (code: GenerateFailure): { ok: false; code: GenerateFailure } => ({ ok: false, code });
const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });

function principalKey(context: CommandContext): string | null {
  const p = context.principal;
  if (p.kind === "outgoing") return `outgoing:${p.actorId}`;
  if (p.kind === "control") return `control:${p.operatorId}`;
  return null;
}

function fingerprint(input: SuggestHandoff): string {
  return createHash("sha256").update(JSON.stringify([input.handoffId, input.expectedVersion, input.representedActorId ?? null])).digest("hex");
}

function noteDto(note: StoredNote): SuggestionResultDTO["note"] {
  return { status: "ready", saved: { output: note.output, provenance: note.provenance, generatedAt: note.generatedAt } };
}

/**
 * Sugerencia de nota (T09). Tres tiempos para no mantener bloqueos durante la llamada IA (C10):
 * 1) lectura corta y reserva idempotente; 2) proveedor, sin transacción; 3) escritura condicionada a la versión leída.
 * Un reset entre 2 y 3 hace fallar la escritura con EXECUTION_STALE y no repuebla la nueva ejecución.
 */
export function createHandoffNoteService(deps: { readonly unitOfWork: UnitOfWork; readonly provider: StructuredProvider }): HandoffNoteService {
  async function read(tx: TransactionRepositories, target: Target): Promise<ServiceResult<Snapshot>> {
    const handoffs = await tx.aggregates.handoffs.list();
    const handoff = target.handoffId ? handoffs.find(h => h.id === target.handoffId) : handoffs[0];
    if (!handoff) return fail("NOT_FOUND");
    if (target.expectedVersion !== undefined && handoff.version !== target.expectedVersion) return fail("VERSION_CONFLICT");
    if (handoff.status !== "draft") return fail("STATE_CONFLICT");
    const [tickets, windows, actors] = await Promise.all([tx.aggregates.tickets.list(), tx.reference.windows(), tx.reference.actors()]);
    const window = windows.find(w => w.id === handoff.windowId);
    const receiver = actors.find(a => a.id === window?.incomingActorId);
    if (!window || !receiver) return fail("STATE_CONFLICT");
    const byId = new Map(tickets.map(t => [t.id, t]));
    const items = handoff.ticketIds.map(id => byId.get(id));
    if (items.some(t => !t)) return fail("STATE_CONFLICT");
    return { ok: true, value: {
      handoffId: handoff.id, version: handoff.version,
      input: { tickets: items.map(t => ({ id: t!.id, reference: t!.reference, text: t!.text })), receiverName: receiver.displayName, policyVersion: POLICY_VERSION },
    } };
  }

  /** Llama al proveedor y devuelve la nota lista para guardar, o el código de error. */
  async function generate(context: CommandContext, snapshot: Snapshot, signal?: AbortSignal): Promise<GenerateResult> {
    const fence: AsyncFence = {
      executionId: context.executionId, version: snapshot.version, correlationId: context.correlationId,
      entity: { kind: "handoff", id: snapshot.handoffId },
    };
    let result;
    try {
      result = await deps.provider.suggest({ task: "note", input: snapshot.input, fence }, signal);
    } catch {
      return failGenerate("PROVIDER_FAILED");
    }
    if (!result.ok) return failGenerate(result.reason === "timeout" ? "PROVIDER_TIMEOUT" : "PROVIDER_FAILED");
    // Una respuesta con otra identidad de trabajo no se guarda (S04).
    const echoed = result.fence;
    if (echoed.executionId !== fence.executionId || echoed.version !== fence.version
      || echoed.entity.kind !== "handoff" || echoed.entity.id !== snapshot.handoffId) return failGenerate("EXECUTION_STALE");
    return { ok: true, value: {
      executionId: context.executionId, version: snapshot.version + 1, output: result.output,
      provenance: result.provenance, generatedAt: context.operationalNow,
    } };
  }

  /** Guarda condicionado a la versión leída. false = el borrador cambió mientras se generaba. */
  async function save(tx: TransactionRepositories, snapshot: Snapshot, note: StoredNote): Promise<ServiceResult<StoredNote>> {
    const current = (await tx.aggregates.handoffs.list()).find(h => h.id === snapshot.handoffId);
    if (!current) return fail("NOT_FOUND");
    if (current.version !== snapshot.version) return fail("VERSION_CONFLICT");
    if (current.status !== "draft") return fail("STATE_CONFLICT");
    return (await tx.notes.save(note, snapshot.version)) ? { ok: true, value: note } : fail("VERSION_CONFLICT");
  }

  return {
    async suggest(context, input, signal) {
      const key = principalKey(context);
      if (!key || context.executionId !== input.executionId) return fail("FORBIDDEN");
      const scope: IdempotencyScope = { executionId: context.executionId, principalKey: key, operation: OPERATION, key: input.idempotencyKey };
      const print = fingerprint(input);

      type Start = { readonly replay: SuggestionResultDTO } | { readonly replayFailure: ErrorCode } | { readonly snapshot: Snapshot };
      const started = await deps.unitOfWork.run<Start>(context, async tx => {
        const reservation = await tx.idempotency.reserve({ ...scope, fingerprint: print, createdAt: context.operationalNow, status: "pending", response: null, successorExecutionId: null });
        if (!reservation.inserted) {
          const record = reservation.record;
          if (record.fingerprint !== print) return fail("IDEMPOTENCY_CONFLICT");
          if (record.status === "pending") return fail("OPERATION_PENDING");
          const saved = record.response;
          if (saved.route !== OPERATION) return fail("IDEMPOTENCY_CONFLICT");
          return saved.response.body.ok ? { ok: true, value: { replay: saved.response.body.data } } : { ok: true, value: { replayFailure: saved.response.body.error.code } };
        }
        const snapshot = await read(tx, { handoffId: input.handoffId, expectedVersion: input.expectedVersion });
        if (!snapshot.ok) return snapshot;
        return { ok: true, value: { snapshot: snapshot.value } };
      });
      if (!started.ok) return started;
      if ("replay" in started.value) return { ok: true, value: started.value.replay };
      if ("replayFailure" in started.value) return fail(started.value.replayFailure);

      const { snapshot } = started.value;
      const generated = await generate(context, snapshot, signal);
      if (!generated.ok) {
        // Registrar el fallo evita dejar la clave pendiente; lo guardado antes no se toca.
        await deps.unitOfWork.run(context, async tx => {
          await tx.idempotency.complete(scope, { route: OPERATION, response: failure(generated.code, context.correlationId) });
          return { ok: true, value: null };
        });
        return generated;
      }
      return deps.unitOfWork.run(context, async tx => {
        const saved = await save(tx, snapshot, generated.value);
        if (!saved.ok) return saved;
        const data: SuggestionResultDTO = { executionId: context.executionId, handoffId: snapshot.handoffId, version: saved.value.version, note: noteDto(saved.value) };
        await tx.idempotency.complete(scope, { route: OPERATION, response: success(data, 200, context.correlationId) });
        return { ok: true, value: data };
      });
    },

    /** Preparación del reset (T11): mismo proveedor y guardado, sin clave idempotente ni versión del cliente. */
    async prepare(context, signal) {
      const read1 = await deps.unitOfWork.run(context, tx => read(tx, {}));
      if (!read1.ok) return read1;
      const generated = await generate(context, read1.value, signal);
      if (!generated.ok) return generated;
      return deps.unitOfWork.run(context, tx => save(tx, read1.value, generated.value));
    },
  };
}
