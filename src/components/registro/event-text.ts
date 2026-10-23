import type { PublicEventDTO } from "@/lib/contracts/client";
import type { EventKind } from "@/lib/contracts/domain";

/** Texto de un evento observado. Describe el hecho registrado; no infiere recepción, atención ni resolución. */
export function eventText(e: Pick<PublicEventDTO, "kind" | "actor" | "result" | "channel">): string {
  const who = e.actor?.displayName;
  const by = who ? ` (${who})` : "";
  const text: Record<EventKind, string> = {
    execution_started: "Nueva ejecución de la demostración",
    scene_changed: "Cambió la escena",
    handoff_sent: `Relevo enviado${by}`,
    handoff_accepted: `${who ?? "El candidato"} aceptó el relevo`,
    handoff_rejected: `${who ?? "El candidato"} no puede cubrir`,
    handoff_expired: `Venció el plazo de aceptación${by}`,
    handoff_derived: `Relevo derivado${who ? ` a ${who}` : ""}`,
    coverage_activated: `Cobertura activa${who ? ` de ${who}` : ""}`,
    coverage_unconfirmed: "Sin cobertura confirmada",
    outgoing_ended: `Terminó el turno${by}`,
    report_admitted: "Reporte recibido",
    report_classified: "Reporte clasificado",
    policy_decided: "Política aplicada al reporte",
    report_linked: "Reporte vinculado a un incidente ya avisado",
    incident_created: "Incidente creado",
    incident_taken: `Incidente tomado${who ? ` por ${who}` : ""}`,
    incident_escalated: `Incidente escalado${who ? ` a ${who}` : ""}`,
    incident_unacknowledged: "Incidente sin acuse",
    notification_intended: `Aviso por preparar${who ? ` para ${who}` : ""}`,
    notification_provider_accepted: `Envío aceptado por ntfy${who ? ` para ${who}` : ""}`,
    notification_failed: `Falló el envío del aviso${who ? ` a ${who}` : ""}`,
    notification_in_app: `Aviso in-app registrado${who ? ` para ${who}` : ""}`,
  };
  return text[e.kind];
}

export const originLabel = (origin: PublicEventDTO["origin"]): string | undefined =>
  origin === "scenario" ? "escenario" : origin === "ntfy_action" ? "acción en ntfy" : undefined;
