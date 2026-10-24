import type { CommandContext } from "../../src/lib/contracts/auth";
import type { Event, Handoff, HandoffAttempt, Incident, IncidentAttempt, NotificationIntent } from "../../src/lib/contracts/domain";
import type { ErrorCode, ServiceResult } from "../../src/lib/contracts/http";
import type { RecipientGrant } from "../../src/lib/contracts/auth";
import type { TransactionRepositories, UnitOfWork } from "../../src/lib/contracts/repositories";

export const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  executionId: "execution_now", executionVersion: 1, principal: { kind: "system" }, actorId: null, origin: "system",
  operationalNow: "2026-10-23T15:00:10.000Z", narrativeNow: "2026-10-24T01:10:00.000Z", correlationId: "correlation_1", ...over,
}) as CommandContext;

export const intent = (over: Partial<NotificationIntent> = {}): NotificationIntent => ({
  executionId: "execution_now", version: 1, id: "notification_1", subject: { kind: "incident", id: "incident_1", attemptId: "incident_attempt_1" },
  recipientActorId: "actor_paula", channel: "ntfy", logicalKey: "k1", status: "pending", createdAt: "2026-10-23T15:00:00.000Z", ...over,
}) as NotificationIntent;

export interface World {
  intents: NotificationIntent[]; events: Event[]; grants: RecipientGrant[];
  incident: Incident | null; incidentAttempt: IncidentAttempt | null; handoff: Handoff | null; handoffAttempt: HandoffAttempt | null;
  currentExecution: string; casLoses: boolean;
}
export function world(over: Partial<World> = {}): World {
  return {
    intents: [intent()], events: [], grants: [], currentExecution: "execution_now", casLoses: false, handoff: null, handoffAttempt: null,
    incident: { executionId: "execution_now", version: 3, id: "incident_1", status: "awaiting_ack", firstReportId: "report_1", currentAttemptId: "incident_attempt_1",
      takenBy: null, takenAt: null, firstNarrativeAt: "2026-10-24T01:00:00.000Z",
      equivalence: { mode: "facts", service: "facturacion", condition: "caida", scope: "generalizado", location: null, resource: null, problem: "sin boletas" } } as Incident,
    incidentAttempt: { executionId: "execution_now", version: 1, id: "incident_attempt_1", incidentId: "incident_1", candidateActorId: "actor_paula", position: 1, status: "pending",
      requestedAt: "2026-10-23T15:00:00.000Z", deadlineAt: "2026-10-23T15:00:30.000Z", respondedAt: null } as IncidentAttempt,
    ...over,
  };
}

/** Doble de UnitOfWork: respeta ejecución vigente y CAS condicionado; no simula PostgreSQL. */
export function fakeUow(w: World): UnitOfWork & { runs: number } {
  const tx = {
    events: { append: async (e: Omit<Event, "id" | "sequence">) => { const full = { ...e, id: `event_${w.events.length + 1}`, sequence: w.events.length + 1 } as Event; w.events.push(full); return full; }, list: async () => w.events },
    credentials: { saveGrant: async (g: RecipientGrant) => { w.grants.push(g); } },
    aggregates: {
      notifications: {
        get: async (id: string) => w.intents.find(n => n.id === id) ?? null, list: async () => w.intents, insert: async () => {},
        compareAndSwap: async (next: NotificationIntent, guard: { version: number; status: string }) => {
          const i = w.intents.findIndex(n => n.id === next.id);
          if (w.casLoses || i < 0 || w.intents[i].version !== guard.version || w.intents[i].status !== guard.status) return false;
          w.intents[i] = next; return true;
        },
      },
      incidents: { get: async () => w.incident }, incidentAttempts: { get: async () => w.incidentAttempt },
      handoffs: { get: async () => w.handoff }, handoffAttempts: { get: async () => w.handoffAttempt },
    },
  } as unknown as TransactionRepositories;
  const uow = {
    runs: 0,
    async run<T>(context: CommandContext, work: (t: TransactionRepositories) => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
      uow.runs++;
      if (context.executionId !== w.currentExecution) return { ok: false, code: "EXECUTION_STALE" as ErrorCode };
      return work(tx);
    },
    runReadFirst<T>(context: CommandContext, work: (t: TransactionRepositories) => Promise<ServiceResult<T>>) { return uow.run(context, work); },
    async replayReset() { return { ok: true as const, value: null }; },
  };
  return uow as UnitOfWork & { runs: number };
}
