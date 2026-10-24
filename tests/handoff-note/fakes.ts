import type { CommandContext } from "../../src/lib/contracts/auth";
import type { StructuredProvider, ProviderResult, NoteOutput } from "../../src/lib/contracts/classification";
import { BASE_FIXTURE } from "../../src/lib/contracts/fixtures";
import type { Handoff, StoredNote, Ticket } from "../../src/lib/contracts/domain";
import type { IdempotencyRecord, IdempotencyScope, SavedResponse, TransactionRepositories, UnitOfWork } from "../../src/lib/contracts/repositories";
import type { ServiceResult } from "../../src/lib/contracts/http";

export const EXECUTION = "execution_t09" as const;
export const HANDOFF = "handoff_t09" as const;

export function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    executionId: EXECUTION, executionVersion: 1, principal: { kind: "outgoing", actorId: "actor_outgoing" }, actorId: "actor_outgoing",
    origin: "web", operationalNow: "2026-10-23T15:00:00.000Z", narrativeNow: "2026-10-24T01:09:50.000Z", correlationId: "correlation_t09",
    ...overrides,
  };
}

interface State { handoff: Handoff; idempotency: Map<string, IdempotencyRecord>; currentExecution: string }

/** Memoria mínima: solo lo que usa el servicio. La persistencia real se prueba en tests/db. */
export function memoryUnitOfWork(initial?: Partial<Handoff>) {
  const tickets: Ticket[] = BASE_FIXTURE.tickets.map(t => ({
    executionId: EXECUTION, version: 1, id: t.id, reference: t.reference, text: t.text,
    suggestedDisposition: null, disposition: t.disposition, reason: "", incidentId: null,
  }));
  const state: State = {
    currentExecution: EXECUTION, idempotency: new Map(),
    handoff: {
      executionId: EXECUTION, version: 1, id: HANDOFF, windowId: BASE_FIXTURE.window.id, outgoingActorId: "actor_outgoing",
      status: "draft", currentAttemptId: null, ticketIds: tickets.map(t => t.id), note: "", savedSuggestion: null,
      sentAt: null, acceptedAt: null, acceptedBy: null, effectiveAt: BASE_FIXTURE.window.startsAt, ...initial,
    },
  };
  const key = (s: { principalKey: string; operation: string; key: string }) => `${s.principalKey}|${s.operation}|${s.key}`;
  const tx: TransactionRepositories = {
    aggregates: {
      handoffs: { list: async () => [state.handoff] },
      tickets: { list: async () => tickets },
    },
    reference: {
      windows: async () => [{ ...BASE_FIXTURE.window, executionId: EXECUTION, backupActorIds: [...BASE_FIXTURE.window.backupActorIds] }],
      actors: async () => [...BASE_FIXTURE.actors],
    },
    notes: {
      get: async () => state.handoff.savedSuggestion,
      async save(note: StoredNote, expected: number) {
        if (state.handoff.version !== expected || note.version !== expected + 1) return false;
        state.handoff = { ...state.handoff, savedSuggestion: note, version: expected + 1 };
        return true;
      },
    },
    idempotency: {
      async reserve(record: Extract<IdempotencyRecord, { status: "pending" }>) {
        const existing = state.idempotency.get(key(record));
        if (existing) return { inserted: false, record: existing };
        state.idempotency.set(key(record), record);
        return { inserted: true, record };
      },
      async complete(scope: IdempotencyScope, response: SavedResponse) {
        const existing = state.idempotency.get(key(scope))!;
        state.idempotency.set(key(scope), { ...existing, status: "completed", response, successorExecutionId: null } as IdempotencyRecord);
      },
    },
  } as unknown as TransactionRepositories;
  const unitOfWork: UnitOfWork = {
    async run<T>(c: CommandContext, work: (t: TransactionRepositories) => Promise<ServiceResult<T>>) {
      if (c.executionId !== state.currentExecution) return { ok: false, code: "EXECUTION_STALE" };
      const before = { handoff: state.handoff, idempotency: new Map(state.idempotency) };
      const result = await work(tx);
      if (!result.ok) { state.handoff = before.handoff; state.idempotency = before.idempotency; }
      return result;
    },
    runReadFirst(c, work) { return unitOfWork.run(c, work); },
    async replayReset() { throw new Error("no usado"); },
  };
  return { unitOfWork, state, tickets };
}

export const OUTPUT: NoteOutput = {
  suggestions: BASE_FIXTURE.tickets.map(t => ({ ticketId: t.id, disposition: t.disposition, reason: "Según la política del ejemplo." })),
  note: "Revisa el próximo intento del respaldo a las 02:00. Los demás pendientes pueden esperar.",
};

export function provider(behavior: (req: Parameters<StructuredProvider["suggest"]>[0]) => Promise<ProviderResult<NoteOutput>> | ProviderResult<NoteOutput>) {
  const calls: Parameters<StructuredProvider["suggest"]>[0][] = [];
  const impl: StructuredProvider = {
    classify: async () => { throw new Error("no usado"); },
    async suggest(req) { calls.push(req); return behavior(req); },
  };
  return { impl, calls };
}
export const okResult = (req: Parameters<StructuredProvider["suggest"]>[0], output: NoteOutput = OUTPUT): ProviderResult<NoteOutput> => ({
  ok: true, fence: req.fence, output, provenance: { provider: "openrouter", api: "structured_chat", model: "test-double", configurationId: "test-only" },
});
