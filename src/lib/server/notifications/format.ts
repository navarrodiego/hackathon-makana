import type { HandoffId, IncidentAttemptId, IncidentId, NotificationId, Service, ExecutionId, Version } from "@/lib/contracts/core";
import type { TakeIncident } from "@/lib/contracts/http";

export interface NtfyAction {
  readonly action: "http"; readonly label: string; readonly url: string; readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>; readonly body: string; readonly clear: boolean;
}
/** Mensaje sin tópico: el transporte lo añade. Contiene secretos solo en click/actions. */
export interface NtfyMessage {
  readonly title: string; readonly message: string; readonly priority: 3 | 5;
  readonly click?: string; readonly actions?: readonly NtfyAction[];
}

const SERVICE_LABEL: Record<Service, string> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};
const CONDITION_LABEL = { caida: "caída", degradacion: "degradada", solicitud: "por revisar" } as const;

export interface IncidentHeadline { readonly service: Service | null; readonly condition: keyof typeof CONDITION_LABEL | null }

export function incidentTitle(h: IncidentHeadline): string {
  if (!h.service || !h.condition) return "P1 · Incidente por revisar";
  return `P1 · ${SERVICE_LABEL[h.service]} ${CONDITION_LABEL[h.condition]}`;
}

/** Aviso de relevo: enlace de revisión. Aceptar o rechazar ocurre con POST en esa página, nunca por este enlace. */
export function handoffMessage(appOrigin: string, handoffId: HandoffId, token: string): NtfyMessage {
  return {
    title: "Relevo para revisar", priority: 3,
    message: "Tienes un relevo por revisar. Abre el enlace para ver el paquete; aceptar es una acción aparte.",
    click: `${appOrigin}/relevo/${encodeURIComponent(handoffId)}?token=${encodeURIComponent(token)}`,
  };
}

export interface IncidentActionInput {
  readonly appOrigin: string; readonly incidentId: IncidentId; readonly attemptId: IncidentAttemptId;
  readonly executionId: ExecutionId; readonly expectedVersion: Version;
  readonly notificationId: NotificationId; readonly token: string;
}
/** Acción HTTP «Tomar incidente»: POST con bearer limitado y clave idempotente fija por aviso. */
export function incidentMessage(headline: IncidentHeadline, input: IncidentActionInput): NtfyMessage {
  const body: TakeIncident = {
    executionId: input.executionId, expectedVersion: input.expectedVersion,
    // Clave C13: solo alfanuméricos, punto, guion y guion bajo; el validador del ack rechaza cualquier otro carácter.
    attemptId: input.attemptId, idempotencyKey: `ack.${input.notificationId}`,
  };
  return {
    title: incidentTitle(headline), priority: 5,
    message: "Incidente sin tomar. Pulsa Tomar incidente para responsabilizarte de atenderlo.",
    actions: [{
      action: "http", label: "Tomar incidente", method: "POST", clear: true,
      url: `${input.appOrigin}/api/ack/${encodeURIComponent(input.incidentId)}`,
      headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }],
  };
}
