import type { ReportReceiptDTO } from "@/lib/contracts/public";
import type { StatusKind } from "@/components/ui/status";

const hour = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });

export interface ReceiptLine {
  /** Marca geométrica que acompaña al texto; nunca el único significado. */
  readonly kind: StatusKind;
  /** Qué ocurrió con el reporte, solo con lo registrado (LANGUAGE). */
  readonly text: string;
  /** Etiquetas que eligió la IA, para que quien reporta vea cómo se entendió su mensaje. */
  readonly classified: string | null;
  /** Orientación fija ante una emergencia física; el canal no la atiende. */
  readonly emergency: string | null;
}

type Classified = NonNullable<ReportReceiptDTO["classified"]>;
const SERVICE: Record<Classified["service"], string> = {
  facturacion: "facturación y cajas", red_locales: "red de locales", correo: "correo", vpn: "VPN",
  impresora: "impresora", cuentas: "cuentas y accesos", otro: "otro servicio",
};
const CONDITION: Record<Classified["condition"], string> = { caida: "no funciona", degradacion: "funciona con fallas", solicitud: "solicitud" };
const SCOPE: Record<Classified["scope"], string> = { persona: "una persona", local_equipo: "un local o equipo", generalizado: "afecta a muchas personas" };
const EMERGENCY = "Este canal es de soporte TI y no atiende emergencias. Si alguien está herido o en peligro, llama al 131 (SAMU), 132 (Bomberos) o 133 (Carabineros) y avisa a tu jefatura.";

function status(receipt: ReportReceiptDTO): Pick<ReceiptLine, "kind" | "text"> {
  switch (receipt.status) {
    case "processing": return { kind: "pending", text: "Clasificando…" };
    case "queued": return {
      kind: "scheduled",
      text: receipt.nextAttentionAt ? `En cola. Próxima atención a las ${hour.format(new Date(receipt.nextAttentionAt))}` : "En cola para la próxima atención",
    };
    case "review": return { kind: "pending", text: "En revisión de la guardia" };
    case "out_of_scope": return { kind: "rerouted", text: "No parece un reporte de TI. No se creó un incidente ni se envió un aviso" };
    case "incident": {
      const registered = receipt.duplicate ? "Incidente ya registrado" : "Incidente registrado";
      if (receipt.takenBy) return { kind: "active", text: `Incidente tomado por ${receipt.takenBy}` };
      return { kind: "scheduled", text: receipt.notifiedTo ? `${registered}. ${receipt.notifiedTo} aún no lo toma` : `${registered}. Nadie lo ha tomado` };
    }
  }
}

/**
 * Estado de un reporte propio para el público. Muestra quién tiene el incidente, no el resultado del proveedor de
 * avisos: «Tomado» no es «resuelto», y que Paula tenga el aviso no afirma que su teléfono lo recibió.
 */
export function receiptLine(receipt: ReportReceiptDTO): ReceiptLine {
  const c = receipt.classified;
  return {
    ...status(receipt),
    classified: receipt.classificationMode === "model" && c
      ? `Clasificación IA: ${SERVICE[c.service]}, ${CONDITION[c.condition]}, ${SCOPE[c.scope]}.` : null,
    emergency: receipt.physicalEmergency ? EMERGENCY : null,
  };
}

/** Longitud en puntos de código Unicode después de trim, igual que el servidor (C13). */
export const reportLength = (text: string) => [...text.trim()].length;
