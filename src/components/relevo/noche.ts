import type { PublicEventDTO, PublicStateDTO } from "@/lib/contracts/client";
import { hhmm } from "@/components/registro/time";

/** Etiqueta de la escena de mañana del seed (`BASE_FIXTURE.scenes`): los ids cambian en cada ejecución, la etiqueta no. */
export const MORNING_SCENE_LABEL = "Registro de mañana";

/** La mañana exige un relevo enviado: sin él no hay noche que resumir y la pantalla sigue en el cierre. */
export function isMorning(state: Pick<PublicStateDTO, "scene" | "handoff" | "closing">): boolean {
  return state.scene.label === MORNING_SCENE_LABEL && state.handoff !== null && state.closing === null;
}

export interface TakenIncident { readonly id: string; readonly by: string; readonly text: string }

/** Lo que Rodrigo necesita saber a la mañana. Lo que envió la sala lo cuenta el proyector con `reportCount`. */
export interface Summary {
  /** Sin eventos en la ejecución vigente. */
  readonly empty: boolean;
  /** De `outgoingNoticeCount`: intenciones de aviso a Rodrigo, no despertares. */
  readonly outgoingNotices: number;
  readonly taken: readonly TakenIncident[];
}

export const SERVICE: Readonly<Record<string, string>> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};

/** Derivado solo del estado de la ejecución vigente; nada se infiere ni se redondea a favor del relato. */
export function summarize(state: Pick<PublicStateDTO, "events" | "incidents" | "outgoingNoticeCount">): Summary {
  const taken = state.incidents
    .filter(i => i.status === "taken" && i.takenBy)
    .map(i => ({
      id: i.id as string, by: i.takenBy!.displayName,
      text: `${SERVICE[i.service] ?? i.service}: tomado por ${i.takenBy!.displayName}${i.takenAt ? ` a las ${hhmm(i.takenAt)}` : ""}`,
    }));
  return { empty: state.events.length === 0, outgoingNotices: state.outgoingNoticeCount, taken };
}

/** Reportes que envió la sala, contados del registro completo (`reports` solo trae los últimos 6). */
export function reportCount(events: readonly Pick<PublicEventDTO, "kind">[]): number {
  return events.filter(e => e.kind === "report_admitted").length;
}
