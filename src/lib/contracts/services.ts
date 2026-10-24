import type { ActorId, HandoffId, IncidentId, Instant, Revision, ReportSessionId } from "./core";
import type { CommandContext } from "./auth";
import type { Classification, EquivalenceKey, PolicyDecision } from "./classification";
import type { Event, Handoff, Incident, NotificationIntent, Report, StoredNote } from "./domain";
import type {
  ChangeQr, ChangeScene, HandoffResultDTO, IncidentResultDTO, ResetExecution, ResetResultDTO,
  RespondHandoff, SendHandoff, ServiceResult, SubmitReport, SuggestHandoff, SuggestionResultDTO, TakeIncident,
} from "./http";
import type { ChannelViewDTO, CoverageDTO, PublicStateDTO, ReportReceiptDTO } from "./public";
import type { ControlViewDTO, HandoffPackageDTO, RodrigoViewDTO } from "./private";
import type { TransactionRepositories } from "./repositories";

export interface HandoffService {
  send(context: CommandContext, input: SendHandoff): Promise<ServiceResult<HandoffResultDTO>>;
  accept(context: CommandContext, id: HandoffId, input: RespondHandoff): Promise<ServiceResult<HandoffResultDTO>>;
  reject(context: CommandContext, id: HandoffId, input: RespondHandoff): Promise<ServiceResult<HandoffResultDTO>>;
  evaluateDeadlines(context: CommandContext): Promise<ServiceResult<readonly HandoffId[]>>;
  effectiveCoverage(context: CommandContext, transaction: TransactionRepositories): Promise<ServiceResult<CoverageDTO | null>>;
  eligibleBackup(context: CommandContext, excludedActorIds: readonly ActorId[], transaction: TransactionRepositories): Promise<ServiceResult<ActorId | null>>;
}
export interface ClassificationService {
  classify(context: CommandContext, report: Report, signal?: AbortSignal): Promise<ServiceResult<Classification>>;
}
export interface PolicyService {
  decide(classification: Classification): PolicyDecision;
  equivalence(report: Report, classification: Classification): EquivalenceKey;
}
export interface HandoffNoteService {
  suggest(context: CommandContext, input: SuggestHandoff, signal?: AbortSignal): Promise<ServiceResult<SuggestionResultDTO>>;
  prepare(context: CommandContext, signal?: AbortSignal): Promise<ServiceResult<StoredNote>>;
}
export interface IncidentService {
  /** Se ejecuta dentro de la TX del ingreso: reporte/incidente/eventos/intención/recibo comparten commit. */
  register(transaction: TransactionRepositories, context: CommandContext, report: Report, classification: Classification, decision: PolicyDecision, key: EquivalenceKey): Promise<ServiceResult<{ readonly incident: Incident | null; readonly duplicate: boolean }>>;
  take(context: CommandContext, id: IncidentId, input: TakeIncident): Promise<ServiceResult<IncidentResultDTO>>;
  evaluateDeadlines(context: CommandContext): Promise<ServiceResult<readonly IncidentId[]>>;
}
export interface MessageService {
  submit(context: CommandContext, input: SubmitReport): Promise<ServiceResult<ReportReceiptDTO>>;
  /**
   * Reportes `processing` sin clasificación guardada tras `LIMITS.classificationStallMs` reales pasan a degradado
   * (`timeout`, revisión de la guardia) y se drena la cola en orden. Devuelve cuántos rescató.
   */
  rescueStalled(context: CommandContext): Promise<ServiceResult<number>>;
}
export type NotificationDeliveryResult =
  | { readonly kind: "provider_accepted"; readonly acceptedAt: Instant; readonly providerMessageId: string | null }
  | { readonly kind: "in_app_recorded"; readonly recordedAt: Instant }
  | { readonly kind: "failed"; readonly reason: "unavailable" | "timeout" | "rejected"; readonly retryable: boolean }
  | { readonly kind: "discarded"; readonly reason: "stale_execution" | "stale_attempt" };
/** T08 resuelve tópico y token desde configuración privada; nunca dentro de DTO públicos. */
export interface NotificationTransport {
  deliver(context: CommandContext, intent: NotificationIntent, signal?: AbortSignal): Promise<NotificationDeliveryResult>;
}
export interface NotificationService {
  dispatchPending(context: CommandContext): Promise<ServiceResult<number>>;
}
export interface ExecutionService {
  changeScene(context: CommandContext, input: ChangeScene): Promise<ServiceResult<PublicStateDTO>>;
  changeQr(context: CommandContext, input: ChangeQr): Promise<ServiceResult<PublicStateDTO>>;
  reset(context: CommandContext, input: ResetExecution): Promise<ServiceResult<ResetResultDTO>>;
  /** Único ensamblador global; invoca motores y avisos sin duplicar sus reglas. */
  evaluate(context: CommandContext): Promise<ServiceResult<PublicStateDTO>>;
}
export interface ReadService {
  publicState(): Promise<ServiceResult<PublicStateDTO>>;
  outgoing(context: CommandContext): Promise<ServiceResult<RodrigoViewDTO>>;
  recipient(context: CommandContext, id: HandoffId): Promise<ServiceResult<HandoffPackageDTO>>;
  control(context: CommandContext): Promise<ServiceResult<ControlViewDTO>>;
  ownReports(context: CommandContext): Promise<ServiceResult<ChannelViewDTO>>;
}
/** Preparación sin enviar HTTP: T03 suministra fixtures antes de T11. */
export interface PreparedExecution extends Revision {
  readonly handoff: Handoff; readonly sessionId: ReportSessionId;
}
export interface EventService<TTransaction> {
  append(transaction: TTransaction, context: CommandContext, event: Omit<Event, "id" | "sequence">): Promise<void>;
}
