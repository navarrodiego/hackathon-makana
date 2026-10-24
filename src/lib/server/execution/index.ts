import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ExecutionId, Instant } from "@/lib/contracts/core";
import type { ChangeScene, ResetExecution, ResetResultDTO, ServiceResult } from "@/lib/contracts/http";
import type { PublicStateDTO } from "@/lib/contracts/public";
import type { ExecutionReader, UnitOfWork } from "@/lib/contracts/repositories";
import type { ExecutionService, HandoffNoteService, HandoffService, IncidentService, MessageService, NotificationService, ReadService } from "@/lib/contracts/services";
import { systemContext } from "@/lib/server/state";
import { prepareNote, resetExecution } from "./reset";
import { changeScene } from "./scene";

export interface ExecutionDeps {
  readonly store: UnitOfWork & ExecutionReader;
  readonly handoff: Pick<HandoffService, "evaluateDeadlines">;
  readonly incidents: Pick<IncidentService, "evaluateDeadlines">;
  readonly notifications: NotificationService;
  readonly note: HandoffNoteService;
  readonly read: Pick<ReadService, "publicState">;
  /** Si existe, cada consulta rescata reportes trabados sin clasificación (C14) antes de evaluar plazos. */
  readonly reports?: Pick<MessageService, "rescueStalled">;
  readonly now: () => Instant;
  /**
   * Si existe, el despacho de avisos corre después de responder (en Next, `after`): un ntfy lento no retrasa la
   * consulta de estado. Sin él, despacha antes de leer, como en las pruebas.
   */
  readonly deferDispatch?: (work: () => Promise<unknown>) => void;
}

/** El servicio de contrato más la preparación de nota que el reset deja para después de responder. */
export interface ExecutionRuntimeService extends ExecutionService {
  /** Genera y guarda la nota de la ejecución vigente y marca `preparation`. Idempotente si ya no está pendiente. */
  prepareNote(context: CommandContext, signal?: AbortSignal): Promise<ServiceResult<"ready" | "failed">>;
  /** Evalúa con un contexto interno de la ejecución vigente; para `GET /api/state`, que no tiene principal. */
  evaluateCurrent(): Promise<ServiceResult<PublicStateDTO>>;
  /** Id de la ejecución vigente, o null si no hay. Solo lectura. */
  currentExecutionId(): Promise<ExecutionId | null>;
}

/**
 * Único ensamblador global (T11). Compone los evaluadores de T06/T10 y el despacho de T08 sin copiar sus
 * transiciones. No hay scheduler: corre cuando alguien consulta el estado (C07).
 */
export function createExecutionService(deps: ExecutionDeps): ExecutionRuntimeService {
  async function evaluate(context: CommandContext): Promise<ServiceResult<PublicStateDTO>> {
    const execution = await deps.store.current();
    if (!execution || execution.executionId !== context.executionId) return { ok: false, code: execution ? "EXECUTION_STALE" : "STORAGE_UNAVAILABLE" };
    const internal = systemContext(execution, deps.now());
    // Cada paso es independiente: si uno falla, el estado igual se entrega y el plazo vencido se reintenta en la
    // próxima consulta. Un fallo de transporte queda como `failed`/pendiente, nunca como recibido.
    const dispatch = () => deps.notifications.dispatchPending(internal);
    for (const step of [
      ...(deps.reports ? [() => deps.reports!.rescueStalled(internal)] : []),
      () => deps.handoff.evaluateDeadlines(internal),
      () => deps.incidents.evaluateDeadlines(internal),
      ...(deps.deferDispatch ? [] : [dispatch]),
    ]) {
      try { await step(); } catch { /* se informa en el estado; no se oculta con éxito falso */ }
    }
    deps.deferDispatch?.(dispatch);
    return deps.read.publicState();
  }
  return {
    changeScene: async (context, input: ChangeScene) => {
      const changed = await changeScene(deps.store, context, input);
      return changed.ok ? evaluate(context) : changed;
    },
    reset: (context, input: ResetExecution): Promise<ServiceResult<ResetResultDTO>> => resetExecution({ store: deps.store }, context, input),
    evaluate,
    prepareNote: (context, signal) => prepareNote({ store: deps.store, note: deps.note }, context, signal),
    async currentExecutionId() { return (await deps.store.current())?.executionId ?? null; },
    async evaluateCurrent() {
      const execution = await deps.store.current();
      if (!execution) return { ok: false, code: "STORAGE_UNAVAILABLE" };
      return evaluate(systemContext(execution, deps.now()));
    },
  };
}
