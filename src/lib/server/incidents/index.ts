import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import { LIMITS, type IncidentAttemptId, type IncidentId, type Instant } from "@/lib/contracts/core";
import type { Incident, IncidentAttempt } from "@/lib/contracts/domain";
import type { ErrorCode, IncidentResultDTO, ServiceResult, TakeIncident } from "@/lib/contracts/http";
import type { TransactionRepositories, UnitOfWork } from "@/lib/contracts/repositories";
import type { HandoffService, IncidentService } from "@/lib/contracts/services";
import { recordEvent } from "@/lib/server/events";
import { incidentService, incidentSummary } from "./dto";
import { fingerprint, idempotentAck } from "./idempotency";
import { eventChannel, noticeForAttempt, noticeForCoordination } from "./notices";

export interface IncidentDeps {
  readonly store: UnitOfWork;
  /** Cobertura efectiva y respaldo elegible: se consumen de T06, no se reimplementan. */
  readonly handoff: Pick<HandoffService, "effectiveCoverage" | "eligibleBackup">;
}
const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const plus = (now: Instant, ms: number) => new Date(Date.parse(now) + ms).toISOString() as Instant;
const due = (now: Instant, attempt: IncidentAttempt) => Date.parse(now) >= Date.parse(attempt.deadlineAt);

export function createIncidentService(deps: IncidentDeps): IncidentService {
  async function coordinatorWindow(tx: TransactionRepositories) {
    const window = (await tx.reference.windows())[0];
    return window ?? null;
  }

  async function newAttempt(tx: TransactionRepositories, context: CommandContext, incident: Incident, candidate: IncidentAttempt["candidateActorId"], position: number): Promise<IncidentAttempt> {
    const attempt: IncidentAttempt = {
      id: `incident_attempt_${randomUUID()}` as IncidentAttemptId, executionId: incident.executionId, version: 1, incidentId: incident.id,
      candidateActorId: candidate, position, status: "pending", requestedAt: context.operationalNow,
      deadlineAt: plus(context.operationalNow, LIMITS.candidateDeadlineMs), respondedAt: null,
    };
    await tx.aggregates.incidentAttempts.insert(attempt);
    return attempt;
  }

  const swapIncident = (tx: TransactionRepositories, current: Incident, next: Incident) =>
    tx.aggregates.incidents.compareAndSwap(next, { executionId: current.executionId, version: current.version, status: current.status, currentAttemptId: current.currentAttemptId });

  async function register(tx: TransactionRepositories, context: CommandContext, report: Parameters<IncidentService["register"]>[2], _classification: Parameters<IncidentService["register"]>[3], decision: Parameters<IncidentService["register"]>[4], key: Parameters<IncidentService["register"]>[5]): ReturnType<IncidentService["register"]> {
    if (decision.route === "queue" || decision.route === "out_of_scope") return { ok: true, value: { incident: null, duplicate: false } };
    await tx.equivalence.lock(key);
    const existing = await tx.equivalence.findWithinWindow(key, report.narrativeAt);
    if (existing) {
      await tx.equivalence.linkReport(report.id, existing.id);
      await recordEvent(tx, context, { kind: "report_linked", entity: { kind: "report", id: report.id }, entityVersion: report.version + 1, channel: eventChannel(context), details: { kind: "record" }, result: "recorded" });
      return { ok: true, value: { incident: existing, duplicate: true } };
    }
    const window = await coordinatorWindow(tx);
    if (!window) return fail("STATE_CONFLICT");
    const coverage = await deps.handoff.effectiveCoverage(context, tx);
    if (!coverage.ok) return coverage;
    const holder = coverage.value?.actor?.id ?? null;
    const incident: Incident = {
      id: `incident_${randomUUID()}` as IncidentId, executionId: context.executionId, version: 1, status: holder ? "awaiting_ack" : "unacknowledged",
      firstReportId: report.id, equivalence: key, firstNarrativeAt: report.narrativeAt, currentAttemptId: null, takenBy: null, takenAt: null,
    };
    await tx.aggregates.incidents.insert(incident);
    await tx.equivalence.linkReport(report.id, incident.id);
    await recordEvent(tx, context, { kind: "incident_created", entity: { kind: "incident", id: incident.id }, entityVersion: 1, channel: eventChannel(context), details: { kind: "transition", from: "none", to: incident.status }, result: "recorded" });
    if (!holder) {
      // C04/R09: sin cobertura efectiva no se inventa técnico; se avisa a coordinación.
      await recordEvent(tx, context, { kind: "incident_unacknowledged", entity: { kind: "incident", id: incident.id }, entityVersion: 1, channel: eventChannel(context), details: { kind: "transition", from: "none", to: "unacknowledged" }, result: "recorded" });
      await noticeForCoordination(tx, context, incident.id, window.coordinatorActorId);
      return { ok: true, value: { incident, duplicate: false } };
    }
    const attempt = await newAttempt(tx, context, incident, holder, 0);
    const linked: Incident = { ...incident, currentAttemptId: attempt.id, version: 2 };
    if (!(await swapIncident(tx, incident, linked))) return fail("VERSION_CONFLICT");
    await noticeForAttempt(tx, context, incident.id, attempt.id, holder, window);
    return { ok: true, value: { incident: linked, duplicate: false } };
  }

  async function view(tx: TransactionRepositories, incident: Incident, attempt: IncidentAttempt | null): Promise<IncidentResultDTO> {
    const [actors, first] = await Promise.all([tx.reference.actors(), tx.aggregates.reports.get(incident.firstReportId)]);
    return { executionId: incident.executionId, incident: incidentSummary(incident, attempt, actors, incidentService(incident, first)) };
  }

  async function take(context: CommandContext, id: IncidentId, input: TakeIncident): Promise<ServiceResult<IncidentResultDTO>> {
    return deps.store.run(context, async tx => {
      const incident = await tx.aggregates.incidents.get(id);
      if (!incident) return fail("NOT_FOUND");
      const attempt = await tx.aggregates.incidentAttempts.get(input.attemptId);
      if (!attempt || attempt.incidentId !== id) return fail("NOT_FOUND");
      const p = context.principal;
      if (!((p.kind === "recipient" || p.kind === "control") && context.actorId === attempt.candidateActorId && (p.kind === "control" || p.actorId === attempt.candidateActorId))) return fail("FORBIDDEN");
      return idempotentAck(tx, context, { key: input.idempotencyKey, fingerprint: fingerprint("POST /api/ack/[id]", { id }, { ...input }) }, async () => {
        if (attempt.status === "expired" || incident.currentAttemptId !== attempt.id) return fail("CANDIDATE_STALE");
        if (attempt.status === "accepted" || incident.status !== "awaiting_ack") return fail("STATE_CONFLICT");
        if (input.expectedVersion !== incident.version) return fail("VERSION_CONFLICT");
        if (due(context.operationalNow, attempt)) return fail("ACTION_EXPIRED");
        const closed: IncidentAttempt = { ...attempt, status: "accepted", respondedAt: context.operationalNow, version: attempt.version + 1 };
        if (!(await tx.aggregates.incidentAttempts.compareAndSwap(closed, { executionId: attempt.executionId, version: attempt.version, status: "pending", candidateActorId: attempt.candidateActorId }))) return fail("VERSION_CONFLICT");
        const taken: Incident = { ...incident, status: "taken", takenBy: attempt.candidateActorId, takenAt: context.operationalNow, version: incident.version + 1 };
        if (!(await swapIncident(tx, incident, taken))) return fail("VERSION_CONFLICT");
        await recordEvent(tx, context, { kind: "incident_taken", entity: { kind: "incident", id }, entityVersion: taken.version, channel: eventChannel(context), details: { kind: "transition", from: "awaiting_ack", to: "taken" }, result: "taken" });
        // Tomar no resuelve ni toca la cobertura (C06): ningún otro agregado cambia aquí.
        return { ok: true, value: await view(tx, taken, closed) };
      });
    });
  }

  async function evaluateDeadlines(context: CommandContext): Promise<ServiceResult<readonly IncidentId[]>> {
    return deps.store.runReadFirst(context, async tx => {
      const changed: IncidentId[] = [];
      const window = await coordinatorWindow(tx);
      for (const incident of await tx.aggregates.incidents.list()) {
        if (incident.status !== "awaiting_ack" || !incident.currentAttemptId) continue;
        const attempt = await tx.aggregates.incidentAttempts.get(incident.currentAttemptId);
        if (!attempt || attempt.status !== "pending" || !due(context.operationalNow, attempt)) continue;
        const expired: IncidentAttempt = { ...attempt, status: "expired", version: attempt.version + 1 };
        // Si otro evaluador o un acuse ganó, no hay nada que hacer: sin escritura previa para este incidente.
        if (!(await tx.aggregates.incidentAttempts.compareAndSwap(expired, { executionId: attempt.executionId, version: attempt.version, status: "pending", candidateActorId: attempt.candidateActorId }))) continue;
        const attempted = (await tx.aggregates.incidentAttempts.list()).filter(a => a.incidentId === incident.id).map(a => a.candidateActorId);
        const next = await deps.handoff.eligibleBackup(context, attempted, tx);
        if (!next.ok) return next;
        if (next.value && window) {
          const fresh = await newAttempt(tx, context, incident, next.value, attempt.position + 1);
          const escalated: Incident = { ...incident, currentAttemptId: fresh.id, version: incident.version + 1 };
          if (!(await swapIncident(tx, incident, escalated))) return fail("VERSION_CONFLICT");
          await recordEvent(tx, context, { kind: "incident_escalated", entity: { kind: "incident", id: incident.id }, entityVersion: escalated.version, channel: eventChannel(context), details: { kind: "transition", from: attempt.candidateActorId, to: next.value }, result: "recorded" });
          await noticeForAttempt(tx, context, incident.id, fresh.id, next.value, window);
        } else {
          // Nadie más es elegible: la coordinación se avisa; no se extiende ni se reasigna a nadie (C06).
          const open: Incident = { ...incident, status: "unacknowledged", currentAttemptId: null, version: incident.version + 1 };
          if (!(await swapIncident(tx, incident, open))) return fail("VERSION_CONFLICT");
          await recordEvent(tx, context, { kind: "incident_unacknowledged", entity: { kind: "incident", id: incident.id }, entityVersion: open.version, channel: eventChannel(context), details: { kind: "transition", from: "awaiting_ack", to: "unacknowledged" }, result: "recorded" });
          if (window) await noticeForCoordination(tx, context, incident.id, window.coordinatorActorId);
        }
        changed.push(incident.id);
      }
      return { ok: true, value: changed };
    });
  }

  return { register, take, evaluateDeadlines };
}
