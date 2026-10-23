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

type Action = "suggest" | "send" | "refresh";
const ACCESS = "No se reconoció tu credencial. Abre la página de nuevo e ingresa con la credencial de Rodrigo.";

/** Qué falló y qué se conserva; nunca afirma que algo se guardó si no se sabe. */
export function errorMessage(code: string, action: Action): string {
  switch (code) {
    case "PROVIDER_FAILED":
    case "PROVIDER_TIMEOUT":
      return "No se pudo generar la nota. Se conserva tu borrador; puedes editarlo y enviarlo, o usar Regenerar otra vez.";
    case "VERSION_CONFLICT":
    case "EXECUTION_STALE":
      return "El relevo cambió mientras lo editabas. Recarga la página para ver el estado actual; tus cambios locales no se enviaron.";
    case "OPERATION_PENDING":
      return "El envío sigue en curso. Espera unos segundos y vuelve a pulsar Enviar relevo: no se duplicará.";
    case "IDEMPOTENCY_CONFLICT":
      return "Este envío ya se registró con otro contenido. Recarga la página para ver qué se envió.";
    case "STATE_CONFLICT":
      return action === "send" ? "Este relevo ya no está en borrador. Recarga la página para ver su estado." : "No se puede regenerar la nota en este estado. Recarga la página.";
    case "AUTH_REQUIRED":
    case "AUTH_INVALID":
    case "AUTH_EXPIRED":
    case "FORBIDDEN":
    case "ORIGIN_REJECTED":
      return ACCESS;
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

/** Deriva el mensaje de continuidad solo de lo registrado; enviar nunca muestra cobertura. */
export function followUp(p: {
  handoff: HandoffSummaryDTO | null; coverage: CoverageDTO | null; outgoing: ActorDTO; firstCandidateId: string | null;
  events: readonly Pick<PublicEventDTO, "sequence" | "kind">[];
}): FollowUp {
  const state = continuityState(p.handoff, p.coverage);
  const incoming = p.coverage?.actor ?? p.handoff?.candidate ?? null;
  const derived = p.handoff?.status === "awaiting_candidate" && p.handoff.candidate && p.firstCandidateId !== null
    && p.handoff.candidate.id !== p.firstCandidateId;
  let coverageNotice: string | null = null;
  if (state === "uncovered" && p.handoff?.status === "uncovered") {
    const lost = p.events.filter(e => e.kind === "coverage_unconfirmed").map(e => e.sequence).sort((a, b) => b - a)[0];
    const noticed = lost !== undefined && p.events.some(e => e.kind === "notification_in_app" && e.sequence > lost);
    coverageNotice = noticed
      ? "Sin cobertura confirmada. Aviso a jefatura registrado en la aplicación."
      : "Sin cobertura confirmada. Aviso a jefatura pendiente.";
  }
  return {
    state, incoming,
    startsAtLabel: p.coverage ? clockLabel(p.coverage.startsAt) : undefined,
    derivedNotice: derived ? `Relevo enviado a ${p.handoff!.candidate!.displayName}; no necesitas reenviarlo.` : null,
    coverageNotice,
  };
}
