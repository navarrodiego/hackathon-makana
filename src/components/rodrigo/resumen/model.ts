import type { PublicEventDTO, PublicStateDTO } from "@/lib/contracts/client";
import type { EventKind } from "@/lib/contracts/domain";
import { hhmm } from "@/components/registro/time";

/** Hechos que importan a la mañana siguiente. El resto (escena, clasificación, política) es ruido para ese repaso. */
const MORNING_KINDS: ReadonlySet<EventKind> = new Set<EventKind>([
  "handoff_sent", "handoff_accepted", "handoff_rejected", "handoff_expired", "handoff_derived",
  "coverage_activated", "coverage_unconfirmed", "outgoing_ended",
  "incident_created", "incident_taken", "incident_escalated", "incident_unacknowledged",
  "notification_provider_accepted", "notification_failed", "notification_in_app",
]);

/** Filtro sobre el registro continuo; no es un registro aparte. */
export function morningEvents<T extends Pick<PublicEventDTO, "kind">>(events: readonly T[]): T[] {
  return events.filter(e => MORNING_KINDS.has(e.kind));
}

export interface TakenIncident { readonly id: string; readonly by: string; readonly text: string }

export interface Summary {
  /** Sin eventos en la ejecución vigente: no se muestran conteos. */
  readonly empty: boolean;
  readonly reportsAdmitted: number;
  readonly incidentsCreated: number;
  readonly incidentsTaken: number;
  readonly coverageActivated: number;
  /** De `outgoingNoticeCount`: intenciones de aviso a Rodrigo, no despertares. */
  readonly outgoingNotices: number;
  readonly taken: readonly TakenIncident[];
}

const SERVICE: Record<string, string> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};

/** Conteos derivados solo del estado de la ejecución vigente; nada se infiere ni se redondea a favor del relato. */
export function summarize(state: Pick<PublicStateDTO, "events" | "incidents" | "outgoingNoticeCount">): Summary {
  const count = (kind: EventKind) => state.events.filter(e => e.kind === kind).length;
  const taken = state.incidents
    .filter(i => i.status === "taken" && i.takenBy)
    .map(i => ({
      id: i.id as string, by: i.takenBy!.displayName,
      text: `${SERVICE[i.service] ?? i.service}: tomado por ${i.takenBy!.displayName}${i.takenAt ? ` a las ${hhmm(i.takenAt)}` : ""}`,
    }));
  return {
    empty: state.events.length === 0,
    reportsAdmitted: count("report_admitted"),
    incidentsCreated: count("incident_created"),
    incidentsTaken: count("incident_taken"),
    coverageActivated: count("coverage_activated"),
    outgoingNotices: state.outgoingNoticeCount,
    taken,
  };
}
