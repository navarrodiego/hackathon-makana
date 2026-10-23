import type { ReportReceiptDTO } from "@/lib/contracts/public";

const hour = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });

export interface ReceiptLines {
  /** Qué ocurrió con el reporte, solo con lo registrado. */
  readonly status: string;
  /** Resultado del aviso observado; nunca equivale a que alguien lo recibió. */
  readonly notice: string | null;
  /** Incertidumbre de la clasificación, cuando la hubo. */
  readonly degraded: string | null;
}

const NOTICE: Record<ReportReceiptDTO["notificationStatus"], string | null> = {
  none: null,
  pending: "Aviso pendiente de envío",
  provider_accepted: "Envío aceptado por ntfy. Eso no confirma que alguien lo haya recibido",
  in_app_recorded: "Aviso registrado en la aplicación",
  failed: "El envío del aviso falló",
};

/** Texto de cada estado del recibo (LANGUAGE): hecho observado, sin prometer atención ni recepción. */
export function receiptLines(receipt: ReportReceiptDTO): ReceiptLines {
  const status = {
    processing: "Procesando. Todavía no hay decisión sobre este reporte",
    queued: receipt.nextAttentionAt ? `En cola. Próxima atención a las ${hour.format(new Date(receipt.nextAttentionAt))}` : "En cola para la próxima atención",
    review: "En revisión de la guardia",
    incident: receipt.duplicate ? "Incidente ya avisado" : "Incidente registrado",
  }[receipt.status];
  return {
    status,
    notice: receipt.status === "incident" ? NOTICE[receipt.notificationStatus] : null,
    degraded: receipt.classificationMode === "degraded"
      ? "No se pudo clasificar el reporte con certeza. Lo revisa la guardia; no se dejó para después por falta de datos."
      : null,
  };
}

/** Longitud en puntos de código Unicode después de trim, igual que el servidor (C13). */
export const reportLength = (text: string) => [...text.trim()].length;
