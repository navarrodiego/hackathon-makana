import type { ReportReceiptDTO } from "@/lib/contracts/public";
import type { StatusKind } from "@/components/ui/status";

const hour = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });

export interface ReceiptLine {
  /** Marca geométrica que acompaña al texto; nunca el único significado. */
  readonly kind: StatusKind;
  /** Qué ocurrió con el reporte, solo con lo registrado (LANGUAGE). */
  readonly text: string;
  /** Cómo entendió la IA el mensaje, en una frase; solo con clasificación del modelo. */
  readonly classified: string | null;
  /** Orientación fija ante una emergencia física; el canal no la atiende. */
  readonly emergency: string | null;
}

type Classified = NonNullable<ReportReceiptDTO["classified"]>;
const SERVICE: Record<Classified["service"], string> = {
  facturacion: "facturación y cajas", red_locales: "red de locales", correo: "correo", vpn: "VPN",
  impresora: "impresora", cuentas: "cuentas y accesos", otro: "otro servicio",
};
/** Frase para quien reporta, no etiquetas sueltas: «impresora sin funcionar, afecta a un local o equipo». */
const SCOPE: Record<Classified["scope"], string> = { persona: "a una persona", local_equipo: "a un local o equipo", generalizado: "a muchas personas" };
const understood = (c: Classified) => {
  const what = c.condition === "solicitud" ? `solicitud de ${SERVICE[c.service]}`
    : `${SERVICE[c.service]} ${c.condition === "caida" ? "sin funcionar" : "con fallas"}`;
  return `La IA entendió: ${what}, afecta ${SCOPE[c.scope]}.`;
};
const EMERGENCY = "Este canal es de soporte TI y no atiende emergencias. Si alguien está herido o en peligro, llama al 131 (SAMU), 132 (Bomberos) o 133 (Carabineros) y avisa a tu jefatura.";

/** Primero la decisión (urgente, no urgente, no está claro) y después qué pasa ahora con el reporte. */
function status(receipt: ReportReceiptDTO): Pick<ReceiptLine, "kind" | "text"> {
  switch (receipt.status) {
    case "processing": return { kind: "pending", text: "Revisando si es urgente…" };
    case "queued": return {
      kind: "scheduled",
      text: receipt.nextAttentionAt
        ? `No es urgente. Queda en cola para las ${hour.format(new Date(receipt.nextAttentionAt))}; nadie recibe un aviso ahora`
        : "No es urgente. Queda en cola; nadie recibe un aviso ahora",
    };
    case "review": return { kind: "pending", text: "No quedó claro si es urgente. Lo revisará una persona de la guardia" };
    case "out_of_scope": return { kind: "rerouted", text: "No parece un problema de TI, así que no se avisó a nadie" };
    case "incident": {
      // Sin clasificación segura del modelo no se afirma la urgencia: se atiende como tal por precaución.
      const urgent = receipt.classificationMode === "model" ? "Urgente" : "Se trata como urgente hasta revisarlo";
      const lead = receipt.duplicate ? `${urgent}. Ya estaba reportado` : urgent;
      if (receipt.takenBy) return { kind: "active", text: `${lead}. ${receipt.takenBy} tomó el incidente` };
      return { kind: "scheduled", text: receipt.notifiedTo ? `${lead}. Le toca a ${receipt.notifiedTo}, que aún no lo toma` : `${lead}. Todavía nadie lo toma` };
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
    classified: receipt.classificationMode === "model" && c ? understood(c) : null,
    emergency: receipt.physicalEmergency ? EMERGENCY : null,
  };
}

/** Longitud en puntos de código Unicode después de trim, igual que el servidor (C13). */
export const reportLength = (text: string) => [...text.trim()].length;
