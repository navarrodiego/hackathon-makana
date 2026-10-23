import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ActorId, Channel, IncidentAttemptId, IncidentId } from "@/lib/contracts/core";
import type { CoverageWindow } from "@/lib/contracts/domain";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import { registerNotificationIntent } from "@/lib/server/events";

/** Solo registra intención (C07). El transporte (T08) y sus tokens no se tocan aquí. */
export function noticeForAttempt(tx: TransactionRepositories, context: CommandContext, incidentId: IncidentId, attemptId: IncidentAttemptId, recipient: ActorId, window: CoverageWindow) {
  // C09: la persona entrante recibe ntfy; respaldos y jefatura se representan in-app. Se decide por rol de la ventana, no por nombre.
  return registerNotificationIntent(tx, context, { subject: { kind: "incident", id: incidentId, attemptId }, recipientActorId: recipient, channel: recipient === window.incomingActorId ? "ntfy" : "in_app" });
}
export function noticeForCoordination(tx: TransactionRepositories, context: CommandContext, incidentId: IncidentId, coordinator: ActorId) {
  return registerNotificationIntent(tx, context, { subject: { kind: "coordination", entity: { kind: "incident", id: incidentId } }, recipientActorId: coordinator, channel: "in_app" });
}
export const eventChannel = (context: CommandContext): Channel =>
  context.origin === "ntfy_action" ? "ntfy" : context.origin === "system" ? "system" : "web";
