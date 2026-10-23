import "server-only";

export interface NtfyConfig {
  readonly baseUrl: string;
  readonly topic: string;
  readonly appOrigin: string;
  readonly timeoutMs: number;
}
export type NtfyState =
  | { readonly state: "disabled" }
  | { readonly state: "misconfigured" }
  | { readonly state: "ready"; readonly config: NtfyConfig };

const DEFAULT_TIMEOUT_MS = 5_000;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const secure = url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));
    return secure && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

/** Falla cerrada: sin habilitación explícita no hay envío; con configuración incompleta tampoco. El tópico nunca sale de aquí por logs ni errores. */
export function readNtfyConfig(env: Record<string, string | undefined> = process.env): NtfyState {
  if (env.NTFY_ENABLED !== "true") return { state: "disabled" };
  const baseUrl = safeOrigin(env.NTFY_BASE_URL);
  const appOrigin = safeOrigin(env.APP_ORIGIN);
  const topic = env.NTFY_TOPIC?.trim();
  if (!baseUrl || !appOrigin || !topic) return { state: "misconfigured" };
  const timeoutMs = Number(env.NTFY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return { state: "ready", config: { baseUrl, topic, appOrigin, timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS } };
}
