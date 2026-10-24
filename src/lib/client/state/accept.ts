import type { PublicStateDTO } from "@/lib/contracts/client";

export interface Accepted {
  readonly state: PublicStateDTO;
  /** `true` cuando este snapshot abrió una ejecución distinta de la anterior (reset). */
  readonly executionChanged: boolean;
}

/**
 * Decide si un snapshot reemplaza al último aceptado (C11/C14).
 * Misma ejecución: solo avanza (versión mayor, o igual con reloj operativo posterior).
 * Otra ejecución: se acepta, porque el reset retira la anterior; nunca se mezcla con ella.
 */
export function acceptSnapshot(prev: PublicStateDTO | null, next: PublicStateDTO): Accepted | null {
  if (!prev) return { state: next, executionChanged: false };
  if (prev.executionId !== next.executionId) return { state: next, executionChanged: true };
  if (next.version < prev.version) return null;
  if (next.version === prev.version && Date.parse(next.clocks.operationalNow) < Date.parse(prev.clocks.operationalNow)) return null;
  return { state: next, executionChanged: false };
}

/** El snapshot más nuevo entre el que trajo la página y el último del sondeo; nunca retrocede (C11/C14). */
export function freshest(base: PublicStateDTO, live: PublicStateDTO | null): PublicStateDTO {
  return live && acceptSnapshot(base, live) ? live : base;
}
