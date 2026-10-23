import type { Actor, Coverage, CoverageWindow, Handoff, HandoffAttempt } from "@/lib/contracts/domain";
import type { CoverageDTO, HandoffSummaryDTO } from "@/lib/contracts/public";
import type { CoverageStatus, ActorId } from "@/lib/contracts/core";

const actorDto = (actors: readonly Actor[], id: ActorId) => {
  const a = actors.find(x => x.id === id);
  return { id, displayName: a?.displayName ?? "" };
};

export function coverageDto(coverage: Coverage, window: CoverageWindow, actors: readonly Actor[]): CoverageDTO {
  const base = { windowId: window.id, startsAt: window.startsAt, endsAt: window.endsAt, outgoingEndsAt: window.outgoingEndsAt } as const;
  return coverage.status === "unconfirmed"
    ? { ...base, status: "unconfirmed", actor: null }
    : { ...base, status: coverage.status as Exclude<CoverageStatus, "unconfirmed">, actor: actorDto(actors, coverage.actorId) };
}

export function handoffSummary(handoff: Handoff, attempt: HandoffAttempt | null, actors: readonly Actor[]): HandoffSummaryDTO {
  const pending = attempt?.status === "pending" ? attempt : null;
  return {
    id: handoff.id, version: handoff.version, status: handoff.status, attemptId: handoff.currentAttemptId,
    candidate: attempt ? actorDto(actors, attempt.candidateActorId) : null, deadlineAt: pending?.deadlineAt ?? null,
    acceptedAt: handoff.acceptedAt, effectiveAt: handoff.effectiveAt,
  };
}
