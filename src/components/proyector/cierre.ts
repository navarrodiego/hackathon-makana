import type { ClosingSummaryDTO, Instant } from "@/lib/contracts/client";
import { hhmm } from "@/components/registro/time";

export interface Cierre { titulo: string; pendientes: string; siguiente: string }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Escena de cierre para la sala mientras el relevo está en borrador. Solo conteos: el proyector no muestra
 * pendientes ni nota. «Aún no se envía» evita que se lea como cobertura. Con el reloj de la historia pasado el fin
 * del turno se habla en pasado: el turno termina a su hora aunque el relevo no se haya enviado.
 */
export function cierre(closing: ClosingSummaryDTO, outgoingEndsAt: Instant | null, narrativeNow: Instant): Cierre {
  const seguimiento = closing.followUpCount > 0
    ? `; ${closing.followUpCount} ${closing.followUpCount === 1 ? "queda" : "quedan"} para seguimiento.`
    : ".";
  const verbo = outgoingEndsAt && Date.parse(narrativeNow) >= Date.parse(outgoingEndsAt) ? "terminó" : "termina";
  const termina = outgoingEndsAt ? `Su turno ${verbo} a las ${hhmm(outgoingEndsAt)}. ` : "";
  return {
    titulo: `${closing.outgoing.displayName} cierra su turno`,
    pendientes: `Deja ${plural(closing.pendingCount, "pendiente", "pendientes")} a quien entra${seguimiento}`,
    siguiente: `${termina}El relevo irá primero a ${closing.firstCandidate.displayName}; aún no se envía.`,
  };
}
