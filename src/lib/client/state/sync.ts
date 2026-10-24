import type { PublicStateDTO } from "@/lib/contracts/client";

/** Ritmo de una pestaña oculta que no marca el reloj de plazos. */
export const HIDDEN_INTERVAL_MS = 5000;
/** Tope de espera tras fallos seguidos: la vista vuelve sola poco después de recuperar la red. */
export const MAX_BACKOFF_MS = 5000;

export interface Cadence {
  readonly intervalMs: number;
  /** Mantiene el ritmo aunque la pestaña esté oculta (proyector: sus lecturas evalúan vencimientos). */
  readonly keepPaceHidden: boolean;
}

/**
 * Lo que una pantalla puede mostrar, sin relojes. La versión de la ejecución no basta: escalados, acuses y
 * avisos cambian su propia entidad sin subirla.
 */
export function stateFingerprint(state: PublicStateDTO): string {
  return JSON.stringify({ ...state, clocks: undefined });
}

/** Varias pantallas en una pestaña comparten un sondeo: gana el ritmo más rápido. */
export function combineCadence(list: readonly Cadence[]): Cadence | null {
  if (list.length === 0) return null;
  return {
    intervalMs: Math.min(...list.map(c => c.intervalMs)),
    keepPaceHidden: list.some(c => c.keepPaceHidden),
  };
}

export function nextDelay(input: Cadence & { readonly hidden: boolean; readonly failures: number }): number {
  const base = input.hidden && !input.keepPaceHidden ? Math.max(input.intervalMs, HIDDEN_INTERVAL_MS) : input.intervalMs;
  if (input.failures === 0) return base;
  return Math.max(base, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (input.failures - 1)));
}

export type RefreshDecision = "baseline" | "changed" | "safety" | null;

/**
 * Cuándo rehacer una vista que llega del servidor (control, canal). Un cambio visible siempre; además una relectura
 * de seguridad para lo privado que no aparece en el estado público, solo con la pestaña visible.
 */
export function refreshDecision(input: {
  readonly fingerprint: string; readonly rendered: string | null;
  readonly sinceRefreshMs: number; readonly safetyMs: number; readonly hidden: boolean;
}): RefreshDecision {
  if (input.rendered === null) return "baseline";
  if (input.fingerprint !== input.rendered) return "changed";
  if (!input.hidden && input.sinceRefreshMs >= input.safetyMs) return "safety";
  return null;
}
