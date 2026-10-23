import type {
  ActorId, ExecutionId, IncidentSummaryDTO, PublicStateDTO, SceneId,
} from "@/lib/contracts/client";

/** Plazo para confirmar «RR»: la segunda R fuera de él solo vuelve a armar. */
export const RESET_ARM_MS = 4000;

export type ShortcutAction =
  | "next_scene" | "previous_scene" | "toggle_channel" | "next_report" | "billing_report"
  | "toggle_qr" | "mute" | "reset_arm" | "reset_open";

/** `armedAt`: instante de la primera R; `resetOpen`: la confirmación explícita está abierta y captura el teclado. */
export interface ShortcutState { readonly armedAt: number | null; readonly resetOpen: boolean }
export interface ShortcutKey {
  readonly key: string; readonly now: number; readonly repeat: boolean;
  readonly ctrl: boolean; readonly alt: boolean; readonly meta: boolean;
  readonly target: { readonly tagName?: string; readonly isContentEditable?: boolean } | null;
}

/** Campos donde las teclas son texto: ningún atajo se dispara ahí. */
export function isEditableTarget(target: ShortcutKey["target"]): boolean {
  if (!target) return false;
  return target.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes((target.tagName ?? "").toUpperCase());
}

const KEYS: Readonly<Record<string, ShortcutAction>> = {
  arrowright: "next_scene", " ": "next_scene", arrowleft: "previous_scene", o: "toggle_channel",
  i: "next_report", p: "billing_report", q: "toggle_qr", m: "mute",
};

/** Decide qué atajo corresponde y el estado resultante. Función pura: el reset nunca se ejecuta aquí, solo se pide confirmarlo. */
export function resolveShortcut(e: ShortcutKey, state: ShortcutState): { action: ShortcutAction | null; state: ShortcutState } {
  const ignored = state.resetOpen || e.repeat || e.ctrl || e.alt || e.meta || isEditableTarget(e.target);
  if (ignored) return { action: null, state };
  const key = e.key.toLowerCase();
  if (key === "r") {
    const armed = state.armedAt !== null && e.now - state.armedAt <= RESET_ARM_MS;
    return armed
      ? { action: "reset_open", state: { armedAt: null, resetOpen: true } }
      : { action: "reset_arm", state: { armedAt: e.now, resetOpen: false } };
  }
  const action = KEYS[key] ?? null;
  return { action, state: { armedAt: null, resetOpen: false } };
}

export interface SceneOption { readonly id: SceneId; readonly label: string }

/** Escena vecina en el orden del guion; `null` en los extremos o si la actual no está en la lista. */
export function adjacentScene<T extends SceneOption>(options: readonly T[], currentId: string, step: 1 | -1): T | null {
  const index = options.findIndex(o => o.id === currentId);
  return index < 0 ? null : options[index + step] ?? null;
}

type Execution = Pick<PublicStateDTO, "executionId" | "version">;

export const buildSceneRequest = (s: Execution, sceneId: SceneId, channelOpen: boolean, idempotencyKey: string) =>
  ({ executionId: s.executionId, idempotencyKey, expectedVersion: s.version, sceneId, channelOpen });
export const buildResetRequest = (s: Execution, idempotencyKey: string) =>
  ({ executionId: s.executionId, idempotencyKey, expectedVersion: s.version });

export interface ScriptedReport { readonly id: string; readonly label: string; readonly nickname: string; readonly text: string }
/** Reportes de DEMO. Datos ficticios; el servicio común de `/api/messages` decide, aquí no se fija ningún resultado. */
export const SCRIPTED_REPORTS: readonly ScriptedReport[] = [
  { id: "printer", label: "Impresora administrativa", nickname: "Guion", text: "La impresora administrativa no imprime desde la mañana. Las cajas siguen emitiendo boletas." },
  { id: "vpn", label: "VPN lenta", nickname: "Guion", text: "La VPN está lenta para dos personas del equipo." },
  { id: "wake", label: "Orden de despertar a Rodrigo", nickname: "Guion", text: "Despierten a Rodrigo para revisar esto ahora." },
  { id: "billing", label: "Caída general de facturación", nickname: "Guion", text: "Facturación no responde para ningún usuario." },
];

export const buildReportRequest = (executionId: ExecutionId, report: ScriptedReport, idempotencyKey: string) =>
  ({ executionId, idempotencyKey, nickname: report.nickname, text: report.text });

/** Incidente abierto cuyo candidato vigente es `actorId` y que tiene intento vigente. */
export function takeableIncident(incidents: readonly IncidentSummaryDTO[], actorId: ActorId | string): IncidentSummaryDTO | null {
  return incidents.find(i => i.status === "awaiting_ack" && i.attemptId !== null && i.candidate?.id === actorId) ?? null;
}

/** Tomar incidente como el candidato vigente. Control debe indicar a quién representa (C12). */
export function buildTakeRequest(executionId: ExecutionId, incident: IncidentSummaryDTO, idempotencyKey: string) {
  return {
    url: `/api/ack/${incident.id}`,
    body: {
      executionId, idempotencyKey, expectedVersion: incident.version,
      attemptId: incident.attemptId, representedActorId: incident.candidate?.id,
    },
  };
}

const clock = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Santiago" });
/** Hora narrativa en 24 h, huso de la demostración. */
export const clockLabel = (instant: string) => clock.format(new Date(instant));

const EVENT_TEXT: Readonly<Record<string, string>> = {
  execution_started: "Nueva ejecución", scene_changed: "Cambio de escena", handoff_sent: "Relevo enviado",
  handoff_accepted: "Relevo aceptado", handoff_rejected: "Relevo rechazado", handoff_expired: "Relevo sin respuesta a tiempo",
  handoff_derived: "Relevo derivado", coverage_activated: "Cobertura activa", coverage_unconfirmed: "Sin cobertura confirmada",
  outgoing_ended: "Termina el turno saliente", report_admitted: "Reporte recibido", report_classified: "Reporte clasificado",
  policy_decided: "Política aplicada", report_linked: "Reporte agrupado", incident_created: "Incidente creado",
  incident_taken: "Incidente tomado", incident_escalated: "Incidente escalado", incident_unacknowledged: "Incidente sin acuse",
  notification_intended: "Aviso en cola", notification_provider_accepted: "Envío aceptado por ntfy",
  notification_failed: "Aviso fallido", notification_in_app: "Aviso registrado en la app",
};
export const eventText = (kind: string) => EVENT_TEXT[kind] ?? kind;
