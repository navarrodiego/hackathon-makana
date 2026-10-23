import type {
  Classification, ClassificationOutput, DegradedReason, EquivalenceKey, PolicyDecision,
} from "../../contracts/classification";
import { POLICY_THRESHOLDS } from "../../contracts/core";
import type { Report } from "../../contracts/domain";
import type { PolicyService } from "../../contracts/services";
import { normalizeText } from "./normalize";

const DEGRADED_REASONS: Record<DegradedReason, string> = {
  timeout: "La clasificación tardó demasiado. Revisión de la guardia.",
  invalid_output: "La clasificación no fue válida. Revisión de la guardia.",
  provider_unavailable: "La clasificación no estuvo disponible. Revisión de la guardia.",
  insufficient_information: "Falta información para clasificar. Revisión de la guardia.",
};

function isCritical(output: ClassificationOutput): boolean {
  switch (output.service) {
    case "facturacion": case "red_locales": return true;
    case "correo": return output.scope === "generalizado";
    case "impresora": return output.blocksBilling === true;
    default: return false;
  }
}

/** Orden fijo: modo degradado, datos dudosos, alcance generalizado, umbrales críticos, cola. Solo lee la clasificación. */
export function decide(classification: Classification): PolicyDecision {
  if (classification.mode === "degraded") return { route: "review", reason: DEGRADED_REASONS[classification.reason] };
  const output = classification.output;
  const { pc } = output;
  if (!Number.isFinite(pc) || pc < 0 || pc > 1 || !output.sufficientInformation) {
    return { route: "review", reason: DEGRADED_REASONS.insufficient_information };
  }
  if (output.scope === "generalizado" && output.condition !== "solicitud") {
    return { route: "notify", reason: "Afecta a muchas personas." };
  }
  if (output.service === "otro") return { route: "review", reason: "Servicio desconocido. Revisión de la guardia." };
  if (output.service === "impresora" && output.blocksBilling === null) {
    return { route: "review", reason: "No se sabe si la impresora bloquea boletas. Revisión de la guardia." };
  }
  if (isCritical(output)) {
    if (pc >= POLICY_THRESHOLDS.notify) return { route: "notify", reason: "Servicio crítico con alta probabilidad de caída." };
    if (pc >= POLICY_THRESHOLDS.review) return { route: "review", reason: "Servicio crítico con probabilidad de caída intermedia." };
  }
  return { route: "queue", reason: "Puede esperar a la próxima atención.", nextAttentionAt: null };
}

/** Sin ventana de tiempo: la aplica el repositorio de equivalencias. */
export function equivalence(report: Pick<Report, "text">, classification: Classification): EquivalenceKey {
  const output = classification.output;
  const problem = output?.evidence.problem ? normalizeText(output.evidence.problem) : "";
  if (classification.mode === "model" && output && problem) {
    const optional = (value: string | null) => (value ? normalizeText(value) || null : null);
    return {
      mode: "facts", service: output.service, condition: output.condition, scope: output.scope,
      location: optional(output.evidence.location), resource: optional(output.evidence.resource), problem,
    };
  }
  return { mode: "text", normalizedText: normalizeText(report.text) };
}

export const policyService: PolicyService = { decide, equivalence };
