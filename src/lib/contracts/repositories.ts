import type { ExecutionId, Instant, ReportSessionId, Version } from "./core";
import type { CommandContext, RecipientGrant } from "./auth";
import type { EquivalenceKey } from "./classification";
import type {
  Actor, Coverage, CoverageWindow, Event, Execution, Handoff, HandoffAttempt,
  Incident, IncidentAttempt, NotificationIntent, Report, ReportSession, Scene, StoredNote, Ticket,
} from "./domain";
import type { ApiResponse, RouteKey, ServiceResult } from "./http";

export interface AggregateMap {
  readonly executions: Execution; readonly tickets: Ticket; readonly handoffs: Handoff;
  readonly handoffAttempts: HandoffAttempt; readonly coverages: Coverage; readonly reports: Report;
  readonly incidents: Incident; readonly incidentAttempts: IncidentAttempt; readonly notifications: NotificationIntent;
}
export type AggregateGuard<K extends keyof AggregateMap> = Pick<AggregateMap[K], "executionId" | "version"> & (
  K extends "handoffs" ? Pick<Handoff, "status" | "currentAttemptId"> :
  K extends "incidents" ? Pick<Incident, "status" | "currentAttemptId"> :
  K extends "handoffAttempts" ? Pick<HandoffAttempt, "status" | "candidateActorId"> :
  K extends "incidentAttempts" ? Pick<IncidentAttempt, "status" | "candidateActorId"> :
  K extends "notifications" ? Pick<NotificationIntent, "status"> :
  K extends "reports" ? Pick<Report, "status"> : object
);
/** get/list siempre acotados a la ejecución bloqueada por la unidad de trabajo. */
export interface AggregateRepository<K extends keyof AggregateMap> {
  get(id: AggregateMap[K] extends { readonly id: infer I } ? I : ExecutionId): Promise<AggregateMap[K] | null>;
  list(): Promise<readonly AggregateMap[K][]>;
  insert(value: AggregateMap[K]): Promise<void>;
  /** UPDATE condicionado; false no escribe ni registra eventos. next.version = guard.version + 1. */
  compareAndSwap(value: AggregateMap[K], guard: AggregateGuard<K>): Promise<boolean>;
}
export type SavedResponse = { [K in RouteKey]: { readonly route: K; readonly response: ApiResponse<K> } }[RouteKey];
export interface IdempotencyScope {
  readonly executionId: ExecutionId; readonly principalKey: string;
  readonly operation: Exclude<RouteKey, "GET /api/state">; readonly key: string;
}
export type IdempotencyRecord = IdempotencyScope & { readonly fingerprint: string; readonly createdAt: Instant } & (
  | { readonly status: "pending"; readonly response: null; readonly successorExecutionId: null }
  | { readonly status: "completed"; readonly response: SavedResponse; readonly successorExecutionId: ExecutionId | null }
);
export interface IdempotencyRepository {
  /** Reserva única de scope; devuelve el registro existente si otra petición ganó. */
  reserve(record: Extract<IdempotencyRecord, { status: "pending" }>): Promise<{ readonly inserted: boolean; readonly record: IdempotencyRecord }>;
  complete(scope: IdempotencyScope, response: SavedResponse, successorExecutionId?: ExecutionId): Promise<void>;
}
export interface QuotaReservation {
  readonly executionId: ExecutionId; readonly sessionId: ReportSessionId;
  readonly remainingSessionReports: number; readonly remainingExecutionReports: number;
  readonly admissionSequence: number;
}
export interface EquivalenceRepository {
  /** Bloqueo transaccional por ejecución + clave canónica, antes de buscar/insertar. */
  lock(key: EquivalenceKey): Promise<void>;
  /** Primer incidente más reciente que cumple [firstNarrativeAt, firstNarrativeAt + 10 min). */
  findWithinWindow(key: EquivalenceKey, narrativeAt: Instant): Promise<Incident | null>;
  linkReport(reportId: Report["id"], incidentId: Incident["id"]): Promise<void>;
}
export interface TransactionRepositories {
  readonly aggregates: { readonly [K in keyof AggregateMap]: AggregateRepository<K> };
  readonly idempotency: IdempotencyRepository;
  readonly equivalence: EquivalenceRepository;
  /** Reportes processing por admissionSequence; caller drena solo prefijo con clasificación guardada. */
  reportsAwaitingDecision(): Promise<readonly Report[]>;
  readonly events: {
    append(event: Omit<Event, "id" | "sequence">): Promise<Event>;
    list(): Promise<readonly Event[]>;
  };
  readonly reference: {
    actors(): Promise<readonly Actor[]>;
    windows(): Promise<readonly CoverageWindow[]>;
    insertWindow(window: CoverageWindow): Promise<void>;
    scenes(): Promise<readonly Scene[]>;
  };
  readonly notes: {
    get(): Promise<StoredNote | null>;
    save(note: StoredNote, expectedHandoffVersion: Version): Promise<boolean>;
  };
  readonly credentials: {
    saveGrant(grant: RecipientGrant): Promise<void>;
    findGrant(hash: string): Promise<RecipientGrant | null>;
    findSession(hash: string): Promise<ReportSession | null>;
    saveSession(session: ReportSession): Promise<void>;
  };
  /** Reserva ambos contadores en la misma transacción. No acepta apodo como identidad. */
  reserveReportQuota(sessionId: ReportSessionId): Promise<ServiceResult<QuotaReservation>>;
  /** Solo reset: cambia vigente y devuelve repositorios de la sucesora dentro de la misma TX. null = conflicto. */
  replaceExecution(next: Execution, expectedVersion: Version): Promise<TransactionRepositories | null>;
}
export interface UnitOfWork {
  /**
   * Bloquea/verifica ejecución vigente hasta commit; un resultado ok:false revierte todo.
   * Nunca mantener esta transacción durante llamadas externas. Un reset concurrente espera
   * o invalida el trabajo; no admite escrituras tardías en ejecuciones retiradas.
   */
  run<T>(context: CommandContext, work: (transaction: TransactionRepositories) => Promise<ServiceResult<T>>): Promise<ServiceResult<T>>;
  /** Solo reintento de reset: verifica principal, fingerprint y sucesora aún vigente. */
  replayReset(scope: IdempotencyScope, fingerprint: string): Promise<ServiceResult<SavedResponse | null>>;
}
export interface ExecutionReader { current(): Promise<Execution | null> }
/** Lecturas de credencial para T05 antes de abrir una transacción de dominio. */
export interface CredentialReader {
  findGrant(credentialHash: string): Promise<RecipientGrant | null>;
  findSession(credentialHash: string): Promise<ReportSession | null>;
}
