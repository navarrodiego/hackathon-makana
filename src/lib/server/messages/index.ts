import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { Classification } from "@/lib/contracts/classification";
import { LIMITS, type ReportId, type ReportSessionId } from "@/lib/contracts/core";
import type { Execution, Report } from "@/lib/contracts/domain";
import type { ApiSuccess, ErrorCode, ServiceResult, SubmitReport } from "@/lib/contracts/http";
import type { ReportReceiptDTO } from "@/lib/contracts/public";
import type { IdempotencyScope, SavedResponse, TransactionRepositories, UnitOfWork } from "@/lib/contracts/repositories";
import type { ClassificationService, IncidentService, MessageService, PolicyService } from "@/lib/contracts/services";
import { recordEvent } from "@/lib/server/events";
import { fingerprint, principalKey } from "@/lib/server/handoff/idempotency";
import { eventChannel } from "@/lib/server/incidents/notices";
import { receipt } from "@/lib/server/state/private";
import { scenarioSessionId } from "./session";

export interface MessageDeps {
  readonly store: UnitOfWork;
  readonly classification: ClassificationService;
  readonly policy: PolicyService;
  /** Solo `register`: el servicio no abre otro commit ni implementa aviso, acuse o escalada. */
  readonly incidents: Pick<IncidentService, "register">;
}

const OPERATION = "POST /api/messages" as const;
const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
const scopeOf = (report: Pick<Report, "executionId" | "principalKey" | "idempotencyKey">): IdempotencyScope =>
  ({ executionId: report.executionId, principalKey: report.principalKey, operation: OPERATION, key: report.idempotencyKey });
const saved = (data: ReportReceiptDTO, correlationId: Report["correlationId"]) =>
  ({ route: OPERATION, response: { status: 201, body: { ok: true, data, correlationId } } }) as unknown as SavedResponse;
const savedData = (record: SavedResponse) => (record.response as ApiSuccess<ReportReceiptDTO, 201>).body.data;

type Admission =
  | { readonly kind: "new"; readonly report: Report }
  | { readonly kind: "done"; readonly receipt: ReportReceiptDTO }
  | { readonly kind: "pending" };

/** Contexto de decisión de un reporte: conserva quién lo envió aunque otra petición drene la cola. */
function contextFor(report: Report, now: CommandContext): CommandContext {
  return {
    ...now, actorId: null, origin: report.origin === "scenario" ? "scenario" : "web", correlationId: report.correlationId,
    principal: report.origin === "scenario" ? { kind: "control", operatorId: "demo_control" } : { kind: "reporter", sessionId: report.sessionId },
  };
}

export function createMessageService(deps: MessageDeps): MessageService {
  /** Fase 1 (C13): idempotencia, canal, cuota y reporte `processing` en una transacción corta. */
  async function admit(context: CommandContext, input: SubmitReport): Promise<ServiceResult<Admission>> {
    const p = context.principal;
    if (p.kind !== "reporter" && p.kind !== "control") return fail("FORBIDDEN");
    return deps.store.run<Admission>(context, async tx => {
      const key = principalKey(context);
      const print = fingerprint(OPERATION, null, { ...input });
      const scope: IdempotencyScope = { executionId: context.executionId, principalKey: key, operation: OPERATION, key: input.idempotencyKey };
      const reserved = await tx.idempotency.reserve({ ...scope, fingerprint: print, createdAt: context.operationalNow, status: "pending", response: null, successorExecutionId: null });
      if (!reserved.inserted) {
        if (reserved.record.fingerprint !== print) return fail("IDEMPOTENCY_CONFLICT");
        if (reserved.record.status === "completed" && reserved.record.response) return { ok: true, value: { kind: "done", receipt: savedData(reserved.record.response) } };
        return { ok: true, value: { kind: "pending" } };
      }
      const execution = await tx.aggregates.executions.get(context.executionId);
      if (!execution) return fail("STORAGE_UNAVAILABLE");
      if (!execution.channelOpen) return fail("CHANNEL_CLOSED");
      // Espera común tras abrir: da tiempo a escanear el QR. Los reportes guionados de control no esperan.
      if (p.kind === "reporter" && execution.channelOpenedAt
        && Date.parse(context.operationalNow) < Date.parse(execution.channelOpenedAt) + LIMITS.channelLobbyMs) return fail("CHANNEL_WAITING");
      const sessionId: ReportSessionId = p.kind === "reporter" ? p.sessionId : await scenarioSessionId(tx, context);
      const quota = await tx.reserveReportQuota(sessionId);
      if (!quota.ok) return quota;
      const report: Report = {
        id: `report_${crypto.randomUUID()}` as ReportId, executionId: context.executionId, version: 1,
        admissionSequence: quota.value.admissionSequence, sessionId, nickname: input.nickname, text: input.text,
        origin: p.kind === "control" ? "scenario" : "web", operationalAt: context.operationalNow, narrativeAt: context.narrativeNow,
        correlationId: context.correlationId, principalKey: key, idempotencyKey: input.idempotencyKey,
        status: "processing", classification: null, decision: null, incidentId: null,
      };
      await tx.aggregates.reports.insert(report);
      await recordEvent(tx, contextFor(report, context), {
        kind: "report_admitted", entity: { kind: "report", id: report.id }, entityVersion: 1, channel: eventChannel(context),
        details: { kind: "record" }, result: "recorded",
      });
      return { ok: true, value: { kind: "new", report } };
    });
  }

  /** Fase 2b: decide, registra y completa el prefijo de reportes ya clasificados, en orden de admisión. */
  async function drain(tx: TransactionRepositories, context: CommandContext): Promise<ServiceResult<Map<ReportId, ReportReceiptDTO>>> {
    const done = new Map<ReportId, ReportReceiptDTO>();
    for (const report of await tx.reportsAwaitingDecision()) {
      const classification = report.classification;
      if (!classification) break;
      const rctx = contextFor(report, context);
      const decision = deps.policy.decide(classification);
      const registered = await deps.incidents.register(tx, rctx, report, classification, decision, deps.policy.equivalence(report, classification));
      if (!registered.ok) return registered;
      const fresh = await tx.aggregates.reports.get(report.id);
      if (!fresh) return fail("STORAGE_UNAVAILABLE");
      const completed: Report = { ...fresh, status: "completed", decision, version: fresh.version + 1 };
      if (!(await tx.aggregates.reports.compareAndSwap(completed, { executionId: fresh.executionId, version: fresh.version, status: "processing" }))) return fail("VERSION_CONFLICT");
      await recordEvent(tx, rctx, {
        kind: "policy_decided", entity: { kind: "report", id: report.id }, entityVersion: completed.version, channel: eventChannel(rctx),
        details: { kind: "policy", decision }, result: "recorded",
      });
      const view = await receiptOf(tx, completed);
      if (!view.ok) return view;
      await tx.idempotency.complete(scopeOf(completed), saved(view.value, completed.correlationId));
      done.set(report.id, view.value);
    }
    return { ok: true, value: done };
  }

  async function receiptOf(tx: TransactionRepositories, report: Report): Promise<ServiceResult<ReportReceiptDTO>> {
    const [execution, incidents, attempts, notifications, actors] = await Promise.all([
      tx.aggregates.executions.get(report.executionId), tx.aggregates.incidents.list(), tx.aggregates.incidentAttempts.list(),
      tx.aggregates.notifications.list(), tx.reference.actors(),
    ]);
    return execution ? { ok: true, value: receipt(report, execution as Execution, { incidents, attempts, notifications, actors }) } : fail("STORAGE_UNAVAILABLE");
  }

  /** Guarda la clasificación solo si la versión del reporte sigue siendo la clasificada y aún no tiene una. */
  async function storeClassification(tx: TransactionRepositories, context: CommandContext, report: Report, classification: Classification): Promise<ServiceResult<null>> {
    const current = await tx.aggregates.reports.get(report.id);
    if (!current) return fail("NOT_FOUND");
    if (current.version !== report.version || current.status !== "processing" || current.classification) return fail("EXECUTION_STALE");
    const next: Report = { ...current, classification, version: current.version + 1 };
    if (!(await tx.aggregates.reports.compareAndSwap(next, { executionId: current.executionId, version: current.version, status: "processing" }))) return fail("EXECUTION_STALE");
    await recordEvent(tx, contextFor(report, context), {
      kind: "report_classified", entity: { kind: "report", id: report.id }, entityVersion: next.version, channel: eventChannel(context),
      details: { kind: "classification", mode: classification.mode, reason: classification.mode === "degraded" ? classification.reason : null }, result: "recorded",
    });
    return { ok: true, value: null };
  }

  /** Fase 2a: guarda la clasificación solo si la ejecución y la versión del reporte siguen vigentes. */
  async function saveClassification(context: CommandContext, report: Report, classification: Classification): Promise<ServiceResult<null>> {
    return deps.store.run(context, tx => storeClassification(tx, context, report, classification));
  }

  const ageMs = (report: Report, context: CommandContext) => Date.parse(context.operationalNow) - Date.parse(report.operationalAt);

  /** Fases 2 y 3 para un reporte admitido; un rescate previo (EXECUTION_STALE de versión) no es error para quien envió. */
  async function classifyAndDrain(context: CommandContext, report: Report): Promise<ServiceResult<ReportReceiptDTO>> {
    const classified = await deps.classification.classify(context, report);
    if (!classified.ok) return classified;
    const stored = await saveClassification(context, report, classified.value);
    if (!stored.ok && stored.code !== "EXECUTION_STALE") return stored;
    return deps.store.run(context, async tx => {
      const drained = await drain(tx, context);
      if (!drained.ok) return drained;
      const own = drained.value.get(report.id);
      if (own) return { ok: true, value: own };
      // Un reporte anterior aún no tiene clasificación: el nuestro queda en procesamiento, sin fingir resultado.
      const current = await tx.aggregates.reports.get(report.id);
      return current ? receiptOf(tx, current) : fail("STORAGE_UNAVAILABLE");
    });
  }

  return {
    async submit(context, input) {
      const admitted = await admit(context, input);
      if (!admitted.ok) return admitted;
      const a = admitted.value;
      if (a.kind === "done") return { ok: true, value: a.receipt };
      if (a.kind === "pending") {
        // Reintento de una operación sin terminar: drena lo ya clasificado, sin repetir cuota. Repite la IA solo si el
        // reporte propio sigue sin clasificación pasado el máximo de espera: la petición original ya no responderá.
        let stalled: Report | null = null;
        const retried = await deps.store.run(context, async tx => {
          const drained = await drain(tx, context);
          if (!drained.ok) return drained;
          const found = await tx.idempotency.reserve({ executionId: context.executionId, principalKey: principalKey(context), operation: OPERATION, key: input.idempotencyKey,
            fingerprint: fingerprint(OPERATION, null, { ...input }), createdAt: context.operationalNow, status: "pending", response: null, successorExecutionId: null });
          if (found.record.status === "completed" && found.record.response) return { ok: true as const, value: savedData(found.record.response) };
          const own = (await tx.reportsAwaitingDecision()).find(r => r.principalKey === principalKey(context) && r.idempotencyKey === input.idempotencyKey);
          if (own && !own.classification && ageMs(own, context) > LIMITS.classificationTimeoutMaxMs) stalled = own;
          return fail("OPERATION_PENDING");
        });
        return stalled ? classifyAndDrain(context, stalled) : retried;
      }
      return classifyAndDrain(context, a.report);
    },
    async rescueStalled(context) {
      return deps.store.runReadFirst(context, async tx => {
        let rescued = 0;
        for (const report of await tx.reportsAwaitingDecision()) {
          if (report.classification || ageMs(report, context) < LIMITS.classificationStallMs) continue;
          const saved = await storeClassification(tx, context, report, { mode: "degraded", reportId: report.id, reason: "timeout", output: null });
          if (!saved.ok) return saved;
          rescued++;
        }
        if (rescued === 0) return { ok: true, value: 0 };
        const drained = await drain(tx, context);
        return drained.ok ? { ok: true, value: rescued } : drained;
      });
    },
  };
}
