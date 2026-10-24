import type { PublicStateDTO } from "@/lib/contracts/client";

/** Ritmo de una pestaña oculta que no marca el reloj de plazos. */
export const HIDDEN_INTERVAL_MS = 5000;
/** Tope de espera tras fallos seguidos: la vista vuelve sola poco después de recuperar la red. */
export const MAX_BACKOFF_MS = 5000;

export interface Cadence {
  readonly intervalMs: number;
  /** Mantiene el ritmo aunque la pestaña esté oculta (proyector: sus lecturas evalúan vencimientos). */
  readonly keepPaceHidden: boolean;
  /** Tope propio tras fallos (canal público). Sin él rige `MAX_BACKOFF_MS`. */
  readonly maxBackoffMs?: number;
  /** Reparte el ritmo ±20 %: muchos teléfonos que abrieron juntos no consultan en el mismo instante. */
  readonly jitter?: boolean;
}

/**
 * Lo que una pantalla puede mostrar, sin relojes. La versión de la ejecución no basta: escalados, acuses y
 * avisos cambian su propia entidad sin subirla.
 */
export function stateFingerprint(state: PublicStateDTO): string {
  return JSON.stringify({ ...state, clocks: undefined });
}

/**
 * Lo que puede cambiar la vista del canal público: apertura, ejecución y el estado de los avisos que muestran sus
 * recibos. Excluye eventos e incidentes sin aviso: con 40 teléfonos, cada reporte ajeno rehacía todas las páginas.
 * Los recibos propios en procesamiento se releen con la relectura de seguridad.
 */
export function channelFingerprint(state: PublicStateDTO): string {
  return JSON.stringify({
    executionId: state.executionId, channelOpen: state.channelOpen,
    notifications: state.notifications.map(n => [n.id, n.status]),
  });
}

/** Varias pantallas en una pestaña comparten un sondeo: gana el ritmo más rápido. */
export function combineCadence(list: readonly Cadence[]): Cadence | null {
  if (list.length === 0) return null;
  // Un tope o un ritmo exacto pedido por cualquiera de las pantallas gana sobre la holgura del canal.
  const backoffs = list.map(c => c.maxBackoffMs);
  return {
    intervalMs: Math.min(...list.map(c => c.intervalMs)),
    keepPaceHidden: list.some(c => c.keepPaceHidden),
    ...(backoffs.every(b => b !== undefined) ? { maxBackoffMs: Math.min(...backoffs) } : {}),
    ...(list.every(c => c.jitter) ? { jitter: true } : {}),
  };
}

/** `random` en [0, 1]; solo cuenta con `jitter`. */
export function nextDelay(input: Cadence & { readonly hidden: boolean; readonly failures: number; readonly random?: number }): number {
  const base = input.hidden && !input.keepPaceHidden ? Math.max(input.intervalMs, HIDDEN_INTERVAL_MS) : input.intervalMs;
  const delay = input.failures === 0 ? base
    : Math.max(base, Math.min(input.maxBackoffMs ?? MAX_BACKOFF_MS, 1000 * 2 ** (input.failures - 1)));
  return input.jitter ? Math.round(delay * (0.8 + 0.4 * (input.random ?? 0.5))) : delay;
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
