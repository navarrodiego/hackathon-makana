import type {
  ActorDTO, CoverageDTO, ExecutionId, HandoffId, HandoffSummaryDTO, PublicEventDTO, TicketDisposition, TicketId,
} from "@/lib/contracts/client";
import { LIMITS } from "@/lib/contracts/client";
import { continuityState, type ContinuityState } from "@/components/relevo/continuity-line";

/** Mismo criterio que el validador del servidor: separar por espacios en blanco. */
export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/u).length : 0;
}

/** La nota es opcional: solo bloquea el envío si pasa del límite. */
export function noteIssue(note: string): string | null {
  const words = countWords(note);
  if (words > LIMITS.noteWords) return `La nota tiene ${words} palabras; el máximo es ${LIMITS.noteWords}. Acórtala para enviar.`;
  return null;
}

export interface DraftTicket { readonly id: string; readonly disposition: TicketDisposition; readonly reason: string }

export function buildSendBody(input: {
  executionId: ExecutionId; handoffId: HandoffId; version: number; idempotencyKey: string; note: string;
  tickets: readonly { id: TicketId; disposition: TicketDisposition; reason: string }[];
}) {
  return {
    executionId: input.executionId, idempotencyKey: input.idempotencyKey, expectedVersion: input.version,
    handoffId: input.handoffId, note: input.note.trim(),
    tickets: input.tickets.map(t => ({ ticketId: t.id, disposition: t.disposition, reason: t.reason.trim() })),
  };
}

/** Un reintento con el mismo contenido reutiliza la clave; con otro contenido el servidor respondería IDEMPOTENCY_CONFLICT. */
export function sendPayloadKey(p: { version: number; note: string; tickets: readonly DraftTicket[] }): string {
  return JSON.stringify([p.version, p.note.trim(), p.tickets.map(t => [t.id, t.disposition, t.reason.trim()])]);
}

const clock = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });
/** Hora de 24 h en Santiago, p. ej. «22:10». */
export function clockLabel(instant: string): string {
  return clock.format(new Date(instant));
}

type Action = "send" | "refresh";
const SESSION = "Tu sesión terminó o ya no es válida. Ingresa de nuevo con la contraseña de operador; tus cambios no se enviaron y se conservan.";

/** Qué falló y qué se conserva; nunca afirma que algo se guardó si no se sabe. */
export function errorMessage(code: string, action: Action): string {
  switch (code) {
    case "VERSION_CONFLICT":
    case "EXECUTION_STALE":
      return "El relevo cambió mientras lo editabas. Recarga la página para ver el estado actual; tus cambios locales no se enviaron.";
    case "OPERATION_PENDING":
      return "El envío sigue en curso. Espera unos segundos y vuelve a pulsar Enviar relevo: no se duplicará.";
    case "IDEMPOTENCY_CONFLICT":
      return "Este envío ya se registró con otro contenido. Recarga la página para ver qué se envió.";
    case "STATE_CONFLICT":
      return "Este relevo ya no está en borrador. Recarga la página para ver su estado.";
    case "AUTH_REQUIRED":
    case "AUTH_INVALID":
    case "AUTH_EXPIRED":
      return SESSION;
    case "FORBIDDEN":
      return "Tu sesión no permite esta acción. No se envió nada. Cierra la sesión e ingresa desde el cierre de turno.";
    case "ORIGIN_REJECTED":
      return "El servidor rechazó la dirección desde la que abriste Relevo. No se envió nada. Abre la dirección oficial o revisa APP_ORIGIN.";
    case "AUTH_NOT_CONFIGURED":
      return "El servidor no tiene configurada la contraseña de operador (OPERATOR_SECRET). No se envió nada.";
    case "INVALID_INPUT":
      return "El servidor no aceptó el contenido. Revisa la nota (hasta 60 palabras) y las razones de cada pendiente.";
    case "STORAGE_UNAVAILABLE":
      return "No se pudo comprobar el estado en el servidor. No hay confirmación de que se guardara; espera unos segundos y reintenta.";
    default:
      return action === "refresh" ? "No se pudo actualizar el estado." : "No se pudo completar la acción. No hay confirmación de que se guardara.";
  }
}

export interface FollowUp {
  readonly state: ContinuityState;
  readonly incoming: ActorDTO | null;
  readonly startsAtLabel: string | undefined;
  readonly derivedNotice: string | null;
  readonly coverageNotice: string | null;
}

/** Último motivo registrado de que el relevo dejó a una persona: plazo vencido o «no puedo cubrir». */
function lastRefusal(events: readonly Pick<PublicEventDTO, "sequence" | "kind">[]): "handoff_expired" | "handoff_rejected" | null {
  const last = events.filter(e => e.kind === "handoff_expired" || e.kind === "handoff_rejected").sort((a, b) => b.sequence - a.sequence)[0];
  return last ? last.kind as "handoff_expired" | "handoff_rejected" : null;
}

/** Deriva el mensaje de continuidad solo de lo registrado; enviar nunca muestra cobertura. */
export function followUp(p: {
  handoff: HandoffSummaryDTO | null; coverage: CoverageDTO | null; outgoing: ActorDTO; firstCandidate: ActorDTO | null;
  events: readonly Pick<PublicEventDTO, "sequence" | "kind">[];
}): FollowUp {
  const state = continuityState(p.handoff, p.coverage);
  const incoming = p.coverage?.actor ?? p.handoff?.candidate ?? null;
  const next = p.handoff?.status === "awaiting_candidate" ? p.handoff.candidate : null;
  const derived = next !== null && p.firstCandidate !== null && next.id !== p.firstCandidate.id;
  let derivedNotice: string | null = null;
  if (derived) {
    // Solo se nombra a la primera persona cuando el motivo está registrado; sin evento no se inventa.
    const refusal = lastRefusal(p.events);
    const why = refusal === "handoff_expired" ? `${p.firstCandidate!.displayName} no aceptó a tiempo. `
      : refusal === "handoff_rejected" ? `${p.firstCandidate!.displayName} no puede cubrir. ` : "";
    derivedNotice = `${why}El relevo pasó a ${next!.displayName}; no necesitas reenviarlo.`;
  }
  let coverageNotice: string | null = null;
  if (state === "uncovered" && p.handoff?.status === "uncovered") {
    const lost = p.events.filter(e => e.kind === "coverage_unconfirmed").map(e => e.sequence).sort((a, b) => b - a)[0];
    const noticed = lost !== undefined && p.events.some(e => e.kind === "notification_in_app" && e.sequence > lost);
    coverageNotice = noticed
      ? "Nadie aceptó el relevo. Sin cobertura confirmada. Aviso a jefatura registrado en la aplicación."
      : "Nadie aceptó el relevo. Sin cobertura confirmada. Aviso a jefatura pendiente.";
  }
  return {
    state, incoming,
    startsAtLabel: p.coverage ? clockLabel(p.coverage.startsAt) : undefined,
    derivedNotice,
    coverageNotice,
  };
}

/** Etiqueta de la escena de mañana del seed (`BASE_FIXTURE.scenes`): los ids cambian en cada ejecución, la etiqueta no. */
const MORNING_SCENE_LABEL = "Registro de mañana";

export type Phase = "closing" | "following" | "morning";

/** Qué momento muestra el cierre. La mañana exige un relevo enviado: sin él no hay noche que resumir. */
export function phaseOf(sent: boolean, sceneLabel: string | null): Phase {
  if (!sent) return "closing";
  return sceneLabel === MORNING_SCENE_LABEL ? "morning" : "following";
}

/** Rótulo del plegable con lo entregado, p. ej. «Lo que dejaste: 5 pendientes y una nota». */
export function leftSummary(tickets: number, note: string): string {
  const items = `${tickets} ${tickets === 1 ? "pendiente" : "pendientes"}`;
  return `Lo que dejaste: ${items}${note.trim() ? " y una nota" : ""}`;
}

/** Cabecera del cierre, legible desde la sala: quién entrega el turno y cuántos pendientes deja. */
export function closingLead(tickets: number): string {
  return `Rodrigo deja ${tickets} ${tickets === 1 ? "pendiente" : "pendientes"} a quien entra.`;
}
