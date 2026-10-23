import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import { LIMITS, type CoverageStatus, type HandoffAttemptId, type Instant } from "@/lib/contracts/core";
import type { Coverage, CoverageWindow, Handoff, HandoffAttempt } from "@/lib/contracts/domain";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import { recordEvent } from "@/lib/server/events";
import { nextCandidate } from "./eligibility";
import { eventChannel, noticeForAttempt, noticeForCoordination } from "./notices";

/** Estado de relevo de la ejecución bloqueada: un relevo, su ventana, su cobertura y el intento vigente. */
export interface HandoffState { handoff: Handoff; window: CoverageWindow; coverage: Coverage; attempt: HandoffAttempt | null }

const at = (i: Instant) => Date.parse(i);
export const plus = (now: Instant, ms: number) => new Date(at(now) + ms).toISOString() as Instant;

export async function loadState(tx: TransactionRepositories): Promise<HandoffState | null> {
  const handoff = (await tx.aggregates.handoffs.list())[0];
  if (!handoff) return null;
  const window = (await tx.reference.windows()).find(w => w.id === handoff.windowId);
  const coverage = (await tx.aggregates.coverages.list()).find(c => c.windowId === handoff.windowId);
  if (!window || !coverage) return null;
  const attempt = handoff.currentAttemptId ? await tx.aggregates.handoffAttempts.get(handoff.currentAttemptId) : null;
  return { handoff, window, coverage, attempt };
}

/** Estado de cobertura por la hora narrativa y el rango de la ventana; el fin del saliente no interviene. */
export function coverageStatusAt(narrative: Instant, window: CoverageWindow): Exclude<CoverageStatus, "unconfirmed"> {
  return at(narrative) < at(window.startsAt) ? "scheduled" : at(narrative) >= at(window.endsAt) ? "ended" : "active";
}

/** CAS que no falla en silencio: false se traduce a conflicto del llamador y revierte la unidad de trabajo. */
export async function closeAttempt(tx: TransactionRepositories, attempt: HandoffAttempt, status: "accepted" | "rejected" | "expired", respondedAt: Instant | null): Promise<HandoffAttempt | null> {
  const next: HandoffAttempt = { ...attempt, status, respondedAt, version: attempt.version + 1 };
  const ok = await tx.aggregates.handoffAttempts.compareAndSwap(next, { executionId: attempt.executionId, version: attempt.version, status: "pending", candidateActorId: attempt.candidateActorId });
  return ok ? next : null;
}

/** Cierra el intento vigente (rechazado o vencido) y deriva al siguiente elegible o declara el hueco. */
export async function endAttemptAndDerive(tx: TransactionRepositories, context: CommandContext, state: HandoffState, cause: "rejected" | "expired"): Promise<boolean> {
  const { handoff, window, coverage, attempt } = state;
  if (!attempt) return false;
  const closed = await closeAttempt(tx, attempt, cause, cause === "rejected" ? context.operationalNow : null);
  if (!closed) return false;
  await recordEvent(tx, context, { kind: cause === "rejected" ? "handoff_rejected" : "handoff_expired", entity: { kind: "handoff", id: handoff.id }, entityVersion: handoff.version, channel: eventChannel(context), details: { kind: "transition", from: "pending", to: cause }, result: "recorded" });
  const attempted = (await tx.aggregates.handoffAttempts.list()).filter(a => a.handoffId === handoff.id).map(a => a.candidateActorId);
  const candidate = nextCandidate(window, attempted);
  if (candidate) {
    const next: HandoffAttempt = {
      id: `handoff_attempt_${randomUUID()}` as HandoffAttemptId, executionId: handoff.executionId, version: 1, handoffId: handoff.id,
      candidateActorId: candidate, position: attempt.position + 1, status: "pending", requestedAt: context.operationalNow,
      deadlineAt: plus(context.operationalNow, LIMITS.candidateDeadlineMs), respondedAt: null,
    };
    await tx.aggregates.handoffAttempts.insert(next);
    const updated: Handoff = { ...handoff, currentAttemptId: next.id, version: handoff.version + 1 };
    if (!(await tx.aggregates.handoffs.compareAndSwap(updated, { executionId: handoff.executionId, version: handoff.version, status: handoff.status, currentAttemptId: handoff.currentAttemptId }))) return false;
    await recordEvent(tx, context, { kind: "handoff_derived", entity: { kind: "handoff", id: handoff.id }, entityVersion: updated.version, channel: eventChannel(context), details: { kind: "transition", from: attempt.candidateActorId, to: candidate }, result: "recorded" });
    await noticeForAttempt(tx, context, handoff.id, next.id, candidate, next.position);
    return true;
  }
  // Sin respaldo elegible: hueco con coordinación. No se extiende al saliente ni se asigna a jefatura (C04).
  const updated: Handoff = { ...handoff, status: "uncovered", currentAttemptId: null, version: handoff.version + 1 };
  if (!(await tx.aggregates.handoffs.compareAndSwap(updated, { executionId: handoff.executionId, version: handoff.version, status: handoff.status, currentAttemptId: handoff.currentAttemptId }))) return false;
  await recordEvent(tx, context, { kind: "coverage_unconfirmed", entity: { kind: "handoff", id: handoff.id }, entityVersion: updated.version, channel: eventChannel(context), details: { kind: "transition", from: "awaiting_candidate", to: "uncovered" }, result: "recorded" });
  await noticeForCoordination(tx, context, handoff.id, window.coordinatorActorId);
  void coverage;
  return true;
}

/** Promociones por reloj narrativo, independientes del plazo del candidato. Idempotente. */
export async function advanceCoverage(tx: TransactionRepositories, context: CommandContext, state: HandoffState): Promise<boolean> {
  let changed = false;
  const { coverage, window, handoff } = state;
  if ((coverage.status === "scheduled" || coverage.status === "active") && coverage.actorId) {
    const target = coverageStatusAt(context.narrativeNow, window);
    if (target !== coverage.status && !(coverage.status === "active" && target === "scheduled")) {
      const next: Coverage = { ...coverage, status: target, version: coverage.version + 1 };
      if (!(await tx.aggregates.coverages.compareAndSwap(next, { executionId: coverage.executionId, version: coverage.version }))) return false;
      if (target === "active") await recordEvent(tx, context, { kind: "coverage_activated", entity: { kind: "handoff", id: handoff.id }, entityVersion: handoff.version, channel: eventChannel(context), details: { kind: "transition", from: coverage.status, to: target }, result: "recorded" });
      changed = true;
    }
  }
  if (at(context.narrativeNow) >= at(window.outgoingEndsAt)) {
    const recorded = (await tx.events.list()).some(e => e.kind === "outgoing_ended");
    if (!recorded) {
      await recordEvent(tx, context, { kind: "outgoing_ended", entity: { kind: "handoff", id: handoff.id }, entityVersion: handoff.version, channel: eventChannel(context), details: { kind: "record" }, result: "recorded" });
      changed = true;
    }
  }
  return changed;
}
