import type { PublicEventDTO } from "@/lib/contracts/client";
import type { EventKind } from "@/lib/contracts/domain";
import { hhmm } from "@/components/registro/time";

/**
 * Hechos del relato para el público del proyector. Deja fuera lo que es puesta en escena (escenas, ejecuciones)
 * o jerga de proveedor (ntfy, in-app): eso vive en /control. Describe lo registrado; no infiere recepción ni resolución.
 */
function texto(e: PublicEventDTO): string | null {
  const who = e.actor?.displayName;
  const text: Partial<Record<EventKind, string>> = {
    handoff_sent: `${who ?? "El turno saliente"} envió el relevo`,
    handoff_accepted: `${who ?? "La persona entrante"} aceptó el relevo`,
    handoff_rejected: `${who ?? "La persona entrante"} no puede cubrir`,
    handoff_expired: `Venció el plazo de aceptación${who ? ` de ${who}` : ""}`,
    handoff_derived: `El relevo pasó${who ? ` a ${who}` : " al respaldo"}`,
    coverage_activated: `${who ?? "La persona entrante"} comenzó su cobertura`,
    coverage_unconfirmed: "Sin cobertura confirmada",
    outgoing_ended: who ? `Terminó el turno de ${who}` : "Terminó el turno saliente",
    report_admitted: "Llegó un reporte",
    incident_created: "Se abrió un incidente",
    incident_escalated: `El incidente pasó${who ? ` a ${who}` : " al respaldo"}`,
    incident_taken: `${who ?? "Alguien"} tomó el incidente`,
    incident_unacknowledged: "Nadie tomó el incidente a tiempo",
  };
  return text[e.kind] ?? null;
}

/**
 * Acciones de personaje que el presentador puede ejecutar desde /control; solo en ellas importa decirlo.
 * La toma de un incidente ya lo dice en «Ahora», junto al incidente.
 */
const ACCIONES: readonly EventKind[] = ["handoff_sent", "handoff_accepted", "handoff_rejected"];

export interface Hecho { id: string; hora: string; texto: string; desdeControl: boolean }

/** Más recientes primero; los reportes seguidos se agrupan («Llegaron 7 reportes») para que el público no tape el relato. */
export function relato(events: readonly PublicEventDTO[], limit = 5): Hecho[] {
  const out: Hecho[] = [];
  let reportes = 0;
  for (const e of [...events].sort((a, b) => b.sequence - a.sequence)) {
    const t = texto(e);
    if (!t) continue;
    const prev = out.at(-1);
    if (e.kind === "report_admitted" && prev && reportes > 0) {
      reportes += 1;
      prev.texto = `Llegaron ${reportes} reportes`;
      continue;
    }
    reportes = e.kind === "report_admitted" ? 1 : 0;
    if (out.length === limit) break;
    out.push({ id: e.id, hora: hhmm(e.narrativeAt), texto: t, desdeControl: e.origin === "scenario" && ACCIONES.includes(e.kind) });
  }
  return out;
}
