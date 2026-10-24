import type { ReportReceiptDTO } from "@/lib/contracts/public";
import type { StatusKind } from "@/components/ui/status";

const hour = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });

export interface ReceiptLine {
  /** Marca geométrica que acompaña al texto; nunca el único significado. */
  readonly kind: StatusKind;
  /** Qué ocurrió con el reporte, solo con lo registrado (LANGUAGE). */
  readonly text: string;
}

/**
 * Estado de un reporte propio para el público. Muestra quién tiene el incidente, no el resultado del proveedor de
 * avisos: «Tomado» no es «resuelto», y que Paula tenga el aviso no afirma que su teléfono lo recibió.
 */
export function receiptLine(receipt: ReportReceiptDTO): ReceiptLine {
  switch (receipt.status) {
    case "processing": return { kind: "pending", text: "Clasificando…" };
    case "queued": return {
      kind: "scheduled",
      text: receipt.nextAttentionAt ? `En cola. Próxima atención a las ${hour.format(new Date(receipt.nextAttentionAt))}` : "En cola para la próxima atención",
    };
    case "review": return { kind: "pending", text: "En revisión de la guardia" };
    case "incident": {
      const registered = receipt.duplicate ? "Incidente ya registrado" : "Incidente registrado";
      if (receipt.takenBy) return { kind: "active", text: `Incidente tomado por ${receipt.takenBy}` };
      return { kind: "scheduled", text: receipt.notifiedTo ? `${registered}. ${receipt.notifiedTo} aún no lo toma` : `${registered}. Nadie lo ha tomado` };
    }
  }
}

/** Longitud en puntos de código Unicode después de trim, igual que el servidor (C13). */
export const reportLength = (text: string) => [...text.trim()].length;
