import type { AsyncFence, Condition, Instant, ReportId, Scope, Service, TicketDisposition, TicketId } from "./core";

/** Literales extraídos del reporte, no identificadores inventados por el modelo. */
export interface FactEvidence {
  readonly location: string | null;
  readonly resource: string | null;
  readonly problem: string | null;
}
export interface ClassificationOutput {
  readonly service: Service;
  readonly condition: Condition;
  readonly scope: Scope;
  /** Finito, entre 0 y 1 inclusive. */
  readonly pc: number;
  readonly manipulation: boolean;
  readonly blocksBilling: boolean | null;
  readonly evidence: FactEvidence;
  readonly sufficientInformation: boolean;
  /** Si el texto es un reporte de TI. Clasificaciones guardadas antes de v2 no lo traen. */
  readonly topic: Topic;
  /** Probabilidad de `no_ti` según el modelo, finita entre 0 y 1. */
  readonly noTiProbability: number;
  /** El texto describe una persona herida o una emergencia de salud o seguridad. Solo agrega orientación al recibo. */
  readonly physicalEmergency: boolean;
}
export type Topic = "ti" | "no_ti" | "dudoso";
export interface ProviderProvenance {
  readonly provider: "openrouter";
  readonly api: "decisions" | "structured_chat";
  readonly model: string;
  readonly configurationId: string;
}
export type DegradedReason = "timeout" | "invalid_output" | "provider_unavailable" | "insufficient_information";
export type Classification =
  | { readonly mode: "model"; readonly reportId: ReportId; readonly output: ClassificationOutput; readonly provenance: ProviderProvenance }
  | { readonly mode: "degraded"; readonly reportId: ReportId; readonly reason: DegradedReason; readonly output: ClassificationOutput | null };
export type PolicyDecision =
  | { readonly route: "queue"; readonly reason: string; readonly nextAttentionAt: Instant | null }
  | { readonly route: "review" | "notify" | "out_of_scope"; readonly reason: string };
/** equality = comparación exacta de todas las partes normalizadas, incluida ejecución fuera de esta clave. */
export type EquivalenceKey =
  | { readonly mode: "facts"; readonly service: Service; readonly condition: Condition; readonly scope: Scope; readonly location: string | null; readonly resource: string | null; readonly problem: string }
  | { readonly mode: "text"; readonly normalizedText: string };
export interface TicketSuggestion { readonly ticketId: TicketId; readonly disposition: TicketDisposition; readonly reason: string }
export interface NoteOutput { readonly suggestions: readonly TicketSuggestion[]; readonly note: string }
export interface NoteInput {
  readonly tickets: readonly { readonly id: TicketId; readonly reference: string; readonly text: string }[];
  readonly receiverName: string;
  /** Identifica la política fija; nunca instrucciones recibidas del canal. */
  readonly policyVersion: "C05-v1";
}
export type ProviderRequest =
  | { readonly task: "classification"; readonly input: { readonly text: string }; readonly fence: AsyncFence }
  | { readonly task: "note"; readonly input: NoteInput; readonly fence: AsyncFence };
export type ProviderResult<T> =
  | { readonly ok: true; readonly fence: AsyncFence; readonly output: T; readonly provenance: ProviderProvenance }
  | { readonly ok: false; readonly fence: AsyncFence; readonly reason: Exclude<DegradedReason, "insufficient_information"> };
/** T02 valida salida runtime; la señal permite cancelar trabajo al resetear. */
export interface StructuredProvider {
  classify(request: Extract<ProviderRequest, { task: "classification" }>, signal?: AbortSignal): Promise<ProviderResult<ClassificationOutput>>;
  suggest(request: Extract<ProviderRequest, { task: "note" }>, signal?: AbortSignal): Promise<ProviderResult<NoteOutput>>;
}
