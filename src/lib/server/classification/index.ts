import type { Classification, ClassificationOutput, StructuredProvider } from "../../contracts/classification";
import { SERVICES, type AsyncFence } from "../../contracts/core";
import type { CommandContext } from "../../contracts/auth";
import type { Report } from "../../contracts/domain";
import type { ClassificationService } from "../../contracts/services";

export interface ClassificationOptions {
  provider: StructuredProvider;
  /** Falso si la ejecución o la versión del reporte ya no están vigentes (p. ej. tras un reinicio). */
  isCurrent?(fence: AsyncFence): Promise<boolean>;
}

const CONDITIONS = ["caida", "degradacion", "solicitud"];
const SCOPES = ["persona", "local_equipo", "generalizado"];

function plausible(output: ClassificationOutput): boolean {
  return (SERVICES as readonly string[]).includes(output.service) && CONDITIONS.includes(output.condition)
    && SCOPES.includes(output.scope) && Number.isFinite(output.pc) && output.pc >= 0 && output.pc <= 1
    && typeof output.manipulation === "boolean" && typeof output.sufficientInformation === "boolean";
}

/** Solo clasifica: no persiste, no emite eventos ni decide destinatarios. */
export function createClassificationService(options: ClassificationOptions): ClassificationService {
  return {
    async classify(context: CommandContext, report: Report, signal?: AbortSignal) {
      const fence: AsyncFence = {
        executionId: context.executionId, version: report.version, correlationId: context.correlationId,
        entity: { kind: "report", id: report.id },
      };
      const result = await options.provider.classify({ task: "classification", input: { text: report.text }, fence }, signal);
      const stale = result.fence.executionId !== fence.executionId || result.fence.version !== fence.version
        || result.fence.entity.id !== fence.entity.id || (options.isCurrent ? !(await options.isCurrent(fence)) : false);
      if (stale) return { ok: false, code: "EXECUTION_STALE" } as const;
      let value: Classification;
      if (!result.ok) value = { mode: "degraded", reportId: report.id, reason: result.reason, output: null };
      else if (!plausible(result.output)) value = { mode: "degraded", reportId: report.id, reason: "invalid_output", output: null };
      else if (!result.output.sufficientInformation) {
        value = { mode: "degraded", reportId: report.id, reason: "insufficient_information", output: result.output };
      } else value = { mode: "model", reportId: report.id, output: result.output, provenance: result.provenance };
      return { ok: true, value } as const;
    },
  };
}
