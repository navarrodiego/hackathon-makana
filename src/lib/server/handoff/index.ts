import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import { LIMITS, type HandoffAttemptId, type Instant } from "@/lib/contracts/core";
import type { Coverage, HandoffAttempt } from "@/lib/contracts/domain";
import type { HandoffId } from "@/lib/contracts/core";
import type { HandoffService } from "@/lib/contracts/services";
import type { ErrorCode, HandoffResultDTO, RespondHandoff, SendHandoff, ServiceResult } from "@/lib/contracts/http";
import type { TransactionRepositories, UnitOfWork } from "@/lib/contracts/repositories";
import { recordEvent } from "@/lib/server/events";
import { coverageDto, handoffSummary } from "./dto";
import { fingerprint, idempotent } from "./idempotency";
import { eventChannel, noticeForAttempt } from "./notices";
import { nextCandidate } from "./eligibility";
import { advanceCoverage, closeAttempt, coverageStatusAt, endAttemptAndDerive, loadState } from "./engine";

export interface HandoffDeps { readonly store: UnitOfWork }
const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const plus = (now: Instant, ms: number) => new Date(Date.parse(now) + ms).toISOString() as Instant;
const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);

export function createHandoffService(deps: HandoffDeps): HandoffService {
  async function send(context: CommandContext, input: SendHandoff): Promise<ServiceResult<HandoffResultDTO>> {
    return deps.store.run(context, async tx => {
      const handoff = await tx.aggregates.handoffs.get(input.handoffId);
      if (!handoff) return fail("NOT_FOUND");
      const p = context.principal;
      const isOutgoing = (p.kind === "outgoing" && p.actorId === handoff.outgoingActorId)
        || (p.kind === "control" && context.actorId === handoff.outgoingActorId);
      if (!isOutgoing) return fail("FORBIDDEN");
      return idempotent(tx, context, { operation: "POST /api/handoff", key: input.idempotencyKey, fingerprint: fingerprint("POST /api/handoff", null, { ...input }), status: 201 }, async () => {
        if (input.expectedVersion !== handoff.version) return fail("VERSION_CONFLICT");
        const ids = new Set(input.tickets.map(t => t.ticketId));
        const valid = ids.size === input.tickets.length && ids.size === handoff.ticketIds.length && handoff.ticketIds.every(id => ids.has(id))
          && words(input.note).length <= LIMITS.noteWords
          && input.tickets.every(t => (t.disposition === "puede_esperar" || t.disposition === "transferir") && t.reason.trim() !== "" && [...t.reason].length <= LIMITS.reportCharacters);
        if (!valid) return fail("INVALID_INPUT");
        if (handoff.status !== "draft") return fail("STATE_CONFLICT");
        const windows = await tx.reference.windows();
        const window = windows.find(w => w.id === handoff.windowId);
        const candidate = window && nextCandidate(window, []);
        if (!window || !candidate) return fail("STATE_CONFLICT");
        for (const t of input.tickets) {
          const ticket = await tx.aggregates.tickets.get(t.ticketId);
          if (!ticket || !(await tx.aggregates.tickets.compareAndSwap({ ...ticket, disposition: t.disposition, reason: t.reason.trim(), version: ticket.version + 1 }, { executionId: ticket.executionId, version: ticket.version }))) return fail("VERSION_CONFLICT");
        }
        const attempt: HandoffAttempt = {
          id: `handoff_attempt_${randomUUID()}` as HandoffAttemptId, executionId: context.executionId, version: 1, handoffId: handoff.id,
          candidateActorId: candidate, position: 0, status: "pending", requestedAt: context.operationalNow,
          deadlineAt: plus(context.operationalNow, LIMITS.candidateDeadlineMs), respondedAt: null,
        };
        await tx.aggregates.handoffAttempts.insert(attempt);
        const next = { ...handoff, status: "awaiting_candidate" as const, currentAttemptId: attempt.id, note: input.note.trim(), sentAt: context.operationalNow, version: handoff.version + 1 };
        const swapped = await tx.aggregates.handoffs.compareAndSwap(next, { executionId: handoff.executionId, version: handoff.version, status: handoff.status, currentAttemptId: handoff.currentAttemptId });
        if (!swapped) return fail("VERSION_CONFLICT");
        await recordEvent(tx, context, { kind: "handoff_sent", entity: { kind: "handoff", id: handoff.id }, entityVersion: next.version, channel: eventChannel(context), details: { kind: "transition", from: "draft", to: "awaiting_candidate" }, result: "recorded" });
        await noticeForAttempt(tx, context, handoff.id, attempt.id, candidate, 0);
        return { ok: true, value: await result(tx, next, attempt) };
      });
    });
  }

  async function result(tx: TransactionRepositories, handoff: Awaited<ReturnType<TransactionRepositories["aggregates"]["handoffs"]["list"]>>[number], attempt: HandoffAttempt | null): Promise<HandoffResultDTO> {
    const [actors, windows, coverages] = await Promise.all([tx.reference.actors(), tx.reference.windows(), tx.aggregates.coverages.list()]);
    const window = windows.find(w => w.id === handoff.windowId)!;
    const coverage = coverages.find(c => c.windowId === window.id)!;
    return { executionId: handoff.executionId, handoff: handoffSummary(handoff, attempt, actors), coverage: coverageDto(coverage, window, actors) };
  }

  type Verb = "accept" | "reject";
  async function respond(context: CommandContext, id: HandoffId, input: RespondHandoff, verb: Verb): Promise<ServiceResult<HandoffResultDTO>> {
    const operation = verb === "accept" ? "POST /api/handoff/[id]/accept" as const : "POST /api/handoff/[id]/reject" as const;
    return deps.store.run(context, async tx => {
      const state = await loadState(tx);
      if (!state || state.handoff.id !== id) return fail("NOT_FOUND");
      const attempt = await tx.aggregates.handoffAttempts.get(input.attemptId);
      if (!attempt || attempt.handoffId !== id) return fail("NOT_FOUND");
      const p = context.principal;
      const acts = (p.kind === "recipient" || p.kind === "control") && context.actorId === attempt.candidateActorId && (p.kind === "control" || p.actorId === attempt.candidateActorId);
      if (!acts) return fail("FORBIDDEN");
      return idempotent(tx, context, { operation, key: input.idempotencyKey, fingerprint: fingerprint(operation, { id }, { ...input }), status: 200 }, async () => {
        const { handoff, window, coverage } = state;
        if (attempt.status === "rejected" || attempt.status === "expired" || handoff.currentAttemptId !== attempt.id) return fail("CANDIDATE_STALE");
        if (attempt.status === "accepted" || handoff.status !== "awaiting_candidate") return fail("STATE_CONFLICT");
        if (input.expectedVersion !== handoff.version) return fail("VERSION_CONFLICT");
        if (Date.parse(context.operationalNow) >= Date.parse(attempt.deadlineAt)) return fail("ACTION_EXPIRED");
        if (verb === "reject") {
          if (!(await endAttemptAndDerive(tx, context, state, "rejected"))) return fail("VERSION_CONFLICT");
        } else {
          const closed = await closeAttempt(tx, attempt, "accepted", context.operationalNow);
          if (!closed) return fail("VERSION_CONFLICT");
          const next = { ...handoff, status: "accepted" as const, acceptedAt: context.operationalNow, acceptedBy: attempt.candidateActorId, effectiveAt: window.startsAt, version: handoff.version + 1 };
          if (!(await tx.aggregates.handoffs.compareAndSwap(next, { executionId: handoff.executionId, version: handoff.version, status: handoff.status, currentAttemptId: handoff.currentAttemptId }))) return fail("VERSION_CONFLICT");
          const status = coverageStatusAt(context.narrativeNow, window);
          const covered: Coverage = { ...coverage, status, actorId: attempt.candidateActorId, acceptedAt: context.operationalNow, version: coverage.version + 1 } as Coverage;
          if (!(await tx.aggregates.coverages.compareAndSwap(covered, { executionId: coverage.executionId, version: coverage.version }))) return fail("VERSION_CONFLICT");
          await recordEvent(tx, context, { kind: "handoff_accepted", entity: { kind: "handoff", id }, entityVersion: next.version, channel: eventChannel(context), details: { kind: "transition", from: "awaiting_candidate", to: "accepted" }, result: "recorded" });
          if (status === "active") await recordEvent(tx, context, { kind: "coverage_activated", entity: { kind: "handoff", id }, entityVersion: next.version, channel: eventChannel(context), details: { kind: "transition", from: "scheduled", to: "active" }, result: "recorded" });
        }
        const after = await loadState(tx);
        return { ok: true, value: await result(tx, after!.handoff, after!.attempt ?? await tx.aggregates.handoffAttempts.get(attempt.id)) };
      });
    });
  }

  return {
    send,
    accept: (context, id, input) => respond(context, id, input, "accept"),
    reject: (context, id, input) => respond(context, id, input, "reject"),
    async evaluateDeadlines(context) {
      return deps.store.runReadFirst(context, async tx => {
        const state = await loadState(tx);
        if (!state) return { ok: true, value: [] };
        let changed = false;
        if (state.handoff.status === "awaiting_candidate" && state.attempt?.status === "pending" && Date.parse(context.operationalNow) >= Date.parse(state.attempt.deadlineAt)) {
          if (!(await endAttemptAndDerive(tx, context, state, "expired"))) return fail("VERSION_CONFLICT");
          changed = true;
        }
        const fresh = (await loadState(tx))!;
        if (await advanceCoverage(tx, context, fresh)) changed = true;
        return { ok: true, value: changed ? [state.handoff.id] : [] };
      });
    },
    /** Solo lectura sobre la tx del ingreso: cobertura aceptada y hora narrativa dentro de [inicio, fin). */
    async effectiveCoverage(context, tx) {
      const state = await loadState(tx);
      if (!state || state.coverage.status === "unconfirmed" || coverageStatusAt(context.narrativeNow, state.window) !== "active") return { ok: true, value: null };
      const actors = await tx.reference.actors();
      return { ok: true, value: coverageDto({ ...state.coverage, status: "active" }, state.window, actors) };
    },
    /** Siguiente elegible por ventana/rol, sin los excluidos; nunca por nombre ni la coordinación. */
    async eligibleBackup(_context, excluded, tx) {
      const state = await loadState(tx);
      return { ok: true, value: state ? nextCandidate(state.window, excluded) : null };
    },
  };
}
