import type { ActorId } from "@/lib/contracts/core";
import type { CoverageWindow } from "@/lib/contracts/domain";

/** Elegibilidad por ventana y rol (C02/C04): entrante, luego respaldos declarados. Nunca por nombre de persona. */
export function candidateOrder(window: CoverageWindow): readonly ActorId[] {
  const ordered = [window.incomingActorId, ...window.backupActorIds].filter(id => id !== window.coordinatorActorId);
  return ordered.filter((id, index) => ordered.indexOf(id) === index);
}

/** Primer candidato aún no intentado; null = sin cobertura (coordinación se avisa aparte). */
export function nextCandidate(window: CoverageWindow, attempted: readonly ActorId[]): ActorId | null {
  return candidateOrder(window).find(id => !attempted.includes(id)) ?? null;
}
