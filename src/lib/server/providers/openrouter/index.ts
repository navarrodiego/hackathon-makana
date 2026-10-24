import "server-only";
import type {
  ClassificationOutput, NoteOutput, ProviderProvenance, ProviderResult, StructuredProvider,
} from "../../../contracts/classification";
import { LIMITS, type AsyncFence } from "../../../contracts/core";
import { chatBody, CONFIGURATION, decisionsBody } from "./prompts";
import { InvalidOutput, modelName, parseChat, parseDecisions, parseEvidence, parseNote } from "./validation";

/** schedule devuelve una función que retira el temporizador. now usa tiempo monotónico. */
export interface ProviderTiming {
  now(): number;
  schedule(delayMs: number, callback: () => void): () => void;
}
export interface OpenRouterOptions {
  apiKey?: string;
  fetch?: typeof fetch;
  noteTimeoutMs?: number;
  /** Por defecto `CLASSIFICATION_TIMEOUT_MS` o `LIMITS.classificationTimeoutMs`, acotado a 1–10 s. */
  classificationTimeoutMs?: number;
  timing?: ProviderTiming;
}
const systemTiming: ProviderTiming = {
  now: () => performance.now(),
  schedule(delay, callback) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
};
type FailureReason = Extract<ProviderResult<never>, { ok: false }>["reason"];
/** Un valor ausente o no numérico usa el límite del contrato; uno fuera de rango se acota. */
function classificationTimeout(raw: string | undefined): number {
  const value = Number(raw);
  if (!raw?.trim() || !Number.isFinite(value)) return LIMITS.classificationTimeoutMs;
  return Math.min(LIMITS.classificationTimeoutMaxMs, Math.max(LIMITS.classificationTimeoutMinMs, value));
}
class ProviderFailure extends Error {
  constructor(readonly reason: FailureReason) { super(reason); }
}
/** Sin IO al construir. La comprobación de ejecución vigente pertenece al consumidor. */
export function createOpenRouterProvider(options: OpenRouterOptions = {}): StructuredProvider {
  const send = options.fetch ?? fetch;
  const key = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  const timing = options.timing ?? systemTiming;
  const noteTimeoutMs = options.noteTimeoutMs ?? 15_000;
  const classificationTimeoutMs = options.classificationTimeoutMs ?? classificationTimeout(process.env.CLASSIFICATION_TIMEOUT_MS);
  async function post(path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    const response = await send(`https://openrouter.ai${path}`, {
      method: "POST", cache: "no-store", signal,
      // Nunca incorporar este encabezado ni cuerpos de error a resultados o logs.
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    signal.throwIfAborted();
    if (!response.ok) {
      // No leer ni propagar mensajes del proveedor. Liberar el stream HTTP cuando sea posible.
      void response.body?.cancel().catch(() => {});
      throw new ProviderFailure("provider_unavailable");
    }
    try {
      const value: unknown = await response.json();
      signal.throwIfAborted();
      return value;
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof SyntaxError) throw new InvalidOutput();
      throw new ProviderFailure("provider_unavailable");
    }
  }
  async function run<T>(
    fence: AsyncFence, timeoutMs: number, external: AbortSignal | undefined,
    work: (signal: AbortSignal) => Promise<{ output: T; provenance: ProviderProvenance }>,
  ): Promise<ProviderResult<T>> {
    if (!key?.trim() || external?.aborted || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return { ok: false, fence, reason: "provider_unavailable" };
    }
    const controller = new AbortController();
    const deadline = timing.now() + timeoutMs;
    let rejectStop: (reason: ProviderFailure) => void = () => {};
    const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
    const stop = (reason: FailureReason) => {
      if (controller.signal.aborted) return;
      rejectStop(new ProviderFailure(reason));
      controller.abort();
    };
    const onAbort = () => stop("provider_unavailable");
    external?.addEventListener("abort", onAbort, { once: true });
    const cancelTimer = timing.schedule(timeoutMs, () => stop("timeout"));
    try {
      const result = await Promise.race([work(controller.signal), stopped]);
      // También corta si JSON/validación síncrona retrasaron el callback del timer.
      if (timing.now() >= deadline) throw new ProviderFailure("timeout");
      return { ok: true, fence, ...result };
    } catch (error) {
      return { ok: false, fence, reason: error instanceof ProviderFailure ? error.reason
        : error instanceof InvalidOutput ? "invalid_output" : "provider_unavailable" };
    } finally {
      cancelTimer();
      external?.removeEventListener("abort", onAbort);
      // Aborta el hermano pendiente incluso ante salida inválida de una sola rama.
      controller.abort();
    }
  }
  return {
    classify(request, signal) {
      return run<ClassificationOutput>(request.fence, classificationTimeoutMs, signal, async internal => {
        const [decision, extraction] = await Promise.all([
          post("/api/alpha/decisions", decisionsBody(request.input.text), internal).then(envelope => ({
            output: parseDecisions(envelope), model: modelName(envelope),
          })),
          post("/api/v1/chat/completions", chatBody("evidence", request.input), internal)
            .then(envelope => parseEvidence(parseChat(envelope), request.input.text)),
        ]);
        return { output: { ...decision.output, evidence: extraction }, provenance: {
          provider: "openrouter", api: "decisions", model: decision.model, configurationId: CONFIGURATION.id,
        } };
      });
    },
    suggest(request, signal) {
      return run<NoteOutput>(request.fence, noteTimeoutMs, signal, async internal => {
        const response = await post("/api/v1/chat/completions", chatBody("note", request.input), internal);
        return { output: parseNote(parseChat(response), request.input), provenance: {
          provider: "openrouter", api: "structured_chat", model: modelName(response), configurationId: CONFIGURATION.id,
        } };
      });
    },
  };
}
