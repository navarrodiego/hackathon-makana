import type { PublicStateDTO } from "@/lib/contracts/client";
import { hhmm } from "@/components/registro/time";

export interface TakenIncident { readonly id: string; readonly by: string; readonly text: string }

/** Lo que Rodrigo necesita saber a la mañana. Los demás conteos y el registro viven en el proyector. */
export interface Summary {
  /** Sin eventos en la ejecución vigente. */
  readonly empty: boolean;
  /** De `outgoingNoticeCount`: intenciones de aviso a Rodrigo, no despertares. */
  readonly outgoingNotices: number;
  readonly taken: readonly TakenIncident[];
}

const SERVICE: Record<string, string> = {
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
