import type { ReportReceiptDTO } from "@/lib/contracts/public";

const hour = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });

export interface ReceiptLines {
  /** Qué ocurrió con el reporte, solo con lo registrado. */
  readonly status: string;
  /** Resultado del aviso observado; nunca equivale a que alguien lo recibió. */
  readonly notice: string | null;
  /** Incertidumbre de la clasificación, cuando la hubo. */
  readonly degraded: string | null;
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
    out_of_scope: "No parece un reporte de TI. No se creó un incidente ni se envió un aviso",
  }[receipt.status];
  const c = receipt.classified;
  return {
    status,
    notice: receipt.status === "incident" ? NOTICE[receipt.notificationStatus] : null,
    degraded: receipt.classificationMode === "degraded" && receipt.status !== "out_of_scope"
      ? "No se pudo clasificar el reporte con certeza. Lo revisa la guardia; no se dejó para después por falta de datos."
      : null,
    classified: receipt.classificationMode === "model" && c
      ? `Clasificación IA: ${SERVICE[c.service]}, ${CONDITION[c.condition]}, ${SCOPE[c.scope]}.` : null,
    emergency: receipt.physicalEmergency ? EMERGENCY : null,
  };
}

/** Longitud en puntos de código Unicode después de trim, igual que el servidor (C13). */
export const reportLength = (text: string) => [...text.trim()].length;
