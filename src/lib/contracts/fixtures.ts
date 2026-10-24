import type { ActorId, ExecutionId, Instant, SceneId, TicketId, WindowId } from "./core";
import type { Actor, Scene } from "./domain";
import type { PreparedExecution } from "./services";

/** Datos ficticios declarativos. T03 materializa IDs aislados por preparación. No es seed ejecutable. */
export interface ExecutionFixture {
  readonly name: string; readonly actors: readonly Actor[]; readonly scenes: readonly Scene[];
  readonly initialSceneId: SceneId; readonly operationalAt: Instant; readonly narrativeAt: Instant;
  readonly channelOpen: boolean;
  readonly window: {
    readonly id: WindowId; readonly outgoingActorId: ActorId; readonly incomingActorId: ActorId;
    readonly backupActorIds: readonly ActorId[]; readonly coordinatorActorId: ActorId;
    readonly startsAt: Instant; readonly endsAt: Instant; readonly outgoingEndsAt: Instant;
  };
  readonly tickets: readonly { readonly id: TicketId; readonly reference: string; readonly text: string; readonly disposition: "puede_esperar" | "transferir"; readonly reason: string }[];
  readonly handoffState: "draft" | "awaiting_candidate" | "accepted" | "uncovered";
  readonly acceptedBy: ActorId | null;
  readonly incident: null | { readonly candidateActorId: ActorId; readonly deadlineOffsetMs: number; readonly status: "awaiting_ack" | "taken" | "unacknowledged" };
  readonly handoffDeadlineOffsetMs: number;
  readonly notePreparation: "not_prepared";
}
export interface FixturePreparer {
  /** Destino local de pruebas permitido; sin push ni llamada IA implícita. */
  prepare(fixture: ExecutionFixture): Promise<PreparedExecution>;
  /** Solo la ejecución creada por este preparador; guarda de destino obligatoria en T03. */
  dispose(executionId: ExecutionId): Promise<void>;
}
export const BASE_FIXTURE = {
  name: "main_before_coverage",
  actors: [
    { id: "actor_outgoing", displayName: "Rodrigo" }, { id: "actor_incoming", displayName: "Paula" },
    { id: "actor_backup", displayName: "Tomás" }, { id: "actor_coordinator", displayName: "Carla" },
  ],
  scenes: [
    { id: "scene_closing", order: 0, label: "Cierre", narrativeAt: "2026-10-24T01:09:50.000Z" },
    { id: "scene_channel", order: 1, label: "Canal", narrativeAt: "2026-10-24T01:10:00.000Z" },
    { id: "scene_night", order: 2, label: "Registro de noche", narrativeAt: "2026-10-24T06:00:00.000Z" },
    { id: "scene_morning", order: 3, label: "Registro de mañana", narrativeAt: "2026-10-24T10:00:00.000Z" },
  ],
  initialSceneId: "scene_closing", operationalAt: "2026-10-23T15:00:00.000Z", narrativeAt: "2026-10-24T01:09:50.000Z",
  channelOpen: false,
  window: {
    id: "window_main", outgoingActorId: "actor_outgoing", incomingActorId: "actor_incoming",
    backupActorIds: ["actor_backup"], coordinatorActorId: "actor_coordinator",
    startsAt: "2026-10-24T01:10:00.000Z", endsAt: "2026-10-24T11:00:00.000Z", outgoingEndsAt: "2026-10-24T01:10:00.000Z",
  },
  tickets: [
    { id: "ticket_481", reference: "#481", text: "Local Coronel: el lector de códigos de la caja 3 no lee; la cajera digita los códigos a mano.", disposition: "puede_esperar", reason: "La caja sigue vendiendo." },
    { id: "ticket_477", reference: "#477", text: "Local Los Ángeles: la impresora de etiquetas de precios de la bodega no imprime.", disposition: "puede_esperar", reason: "No afecta las ventas." },
    { id: "ticket_470", reference: "#470", text: "El cierre de caja de 6 locales no llegó a la central; el sistema reintenta a las 02:00.", disposition: "transferir", reason: "Revisa si el reintento de las 02:00 funcionó." },
    { id: "ticket_466", reference: "#466", text: "Bodega de Talcahuano: la consulta de stock va lenta por la VPN.", disposition: "puede_esperar", reason: "Afecta solo a la bodega." },
    { id: "ticket_462", reference: "#462", text: "Crear la cuenta de la nueva cajera del local Chillán; entra el lunes.", disposition: "puede_esperar", reason: "Se necesita para el lunes." },
  ],
  handoffState: "draft", acceptedBy: null, incident: null,
  handoffDeadlineOffsetMs: 30_000, notePreparation: "not_prepared",
} as const satisfies ExecutionFixture;
/**
 * Resumen de traspaso del escenario, fijo en el código: el cierre no usa IA. Coincide con los pendientes de
 * `BASE_FIXTURE` (solo #470 para seguimiento) y cabe en el límite de la nota; Rodrigo puede editarlo antes de enviar.
 */
export const HANDOFF_SUMMARY = "Paula: dejo cinco pendientes. Solo el #470 necesita seguimiento: el cierre de caja de 6 locales no llegó a la central y el sistema reintenta a las 02:00. Revisa si funcionó. Los demás pueden esperar a la mañana; ninguno detiene las ventas.";
/** Misma persona, otro rol explícito: no hay regla por el nombre Rodrigo. */
export const OUTGOING_ELIGIBLE_FIXTURE = {
  ...BASE_FIXTURE, name: "outgoing_explicit_backup",
  window: { ...BASE_FIXTURE.window, backupActorIds: ["actor_outgoing"] },
} as const satisfies ExecutionFixture;
export const ACCEPTED_FIXTURE = {
  ...BASE_FIXTURE, name: "accepted_before_window", handoffState: "accepted", acceptedBy: "actor_incoming",
} as const satisfies ExecutionFixture;
export const INCIDENT_FIXTURE = {
  ...ACCEPTED_FIXTURE, name: "independent_deadlines", channelOpen: true,
  narrativeAt: "2026-10-24T01:10:01.000Z",
  incident: { candidateActorId: "actor_incoming", deadlineOffsetMs: 30_000, status: "awaiting_ack" },
  handoffDeadlineOffsetMs: 10_000,
} as const satisfies ExecutionFixture;
